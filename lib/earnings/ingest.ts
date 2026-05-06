/**
 * Amazon Associates report → commissions ingestion.
 *
 * The CSV format we expect comes from Reports → Orders Report (or the
 * subtag-specific tab on accounts that have it). It's order-level with
 * the click's `ascsubtag` value preserved as a column. The exact column
 * name varies — Amazon has shipped the field as "SubTag", "Sub Tag",
 * "Tracking ID Sub", "ascsubtag", and "Custom Tag" depending on tooling.
 * We auto-detect it by header normalization rather than hardcoding.
 *
 * Each click_events row's id (a UUID we insert before the redirect) is
 * the subtag value. So a successful parse joins:
 *
 *    csv_row.subtag === click_events.id
 *
 * From there we pull creator_id off the click_events row (RLS-scoped
 * via service role at ingestion time since this is admin-only) and
 * write the commissions row.
 */

export interface ParsedAmazonRow {
  /** click_events.id — extracted from the subtag column. */
  subtag: string | null;
  /** Order or transaction id from Amazon. */
  transactionId: string | null;
  /** ASIN of the product (when present in the report). */
  asin: string | null;
  productTitle: string | null;
  orderDate: string | null;
  /** Pre-tax sale amount. */
  saleAmount: number | null;
  /** Gross commission Amazon will pay (this is what's in the report). */
  commissionTotal: number | null;
  /** Status text from the report — mapped to our enum below. */
  rawStatus: string | null;
  status: "pending" | "confirmed" | "paid" | "rejected";
  /** Tracking ID e.g. "styledinmotio-20" — for sanity-check audit. */
  trackingId: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Normalize a CSV header — lowercase, drop punctuation/spaces — so we can
 * match across Amazon's varying column names.
 */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Header aliases we accept for each logical field. */
const HEADER_ALIASES: Record<keyof ParsedAmazonRow, string[]> = {
  subtag: ["subtag", "ascsubtag", "trackingidsub", "trackingidsubtag", "customtag", "customsubtag"],
  transactionId: ["orderid", "ordernumber", "transactionid", "shipmentid"],
  asin: ["asin"],
  productTitle: ["title", "producttitle", "name", "productname"],
  orderDate: ["date", "dateshipped", "shippeddate", "orderdate"],
  saleAmount: ["price", "itemprice", "revenue", "ordervalue", "shippedrevenue", "itemsshippedrevenue"],
  commissionTotal: ["earnings", "totalearnings", "itemsshippedearnings", "commission", "ad_fees"],
  rawStatus: ["status", "type", "category"],
  status: [],
  trackingId: ["trackingid", "tag", "associatetag"],
};

/**
 * Build a column-name → field-name map from the CSV header row.
 */
function buildHeaderIndex(headers: string[]): Map<string, keyof ParsedAmazonRow> {
  const index = new Map<string, keyof ParsedAmazonRow>();
  for (const [field, aliases] of Object.entries(HEADER_ALIASES) as Array<
    [keyof ParsedAmazonRow, string[]]
  >) {
    if (aliases.length === 0) continue;
    for (const h of headers) {
      if (aliases.includes(normalizeHeader(h)) && !index.has(h)) {
        index.set(h, field);
        break; // first match wins per logical field
      }
    }
  }
  return index;
}

/**
 * Map Amazon's status text to our 4-state enum.
 *   "Earned" / "Confirmed" / "Paid" → confirmed (or paid if explicit)
 *   "Pending" / "Awaiting return" / "Direct" / "Indirect" → pending
 *   "Returned" / "Cancelled" / "Rejected" → rejected
 */
function mapStatus(raw: string | null): ParsedAmazonRow["status"] {
  if (!raw) return "pending";
  const v = raw.trim().toLowerCase();
  if (/paid/.test(v)) return "paid";
  if (/(earned|confirm|approved)/.test(v)) return "confirmed";
  if (/(return|cancel|reject|refund|reverse)/.test(v)) return "rejected";
  return "pending";
}

function parseNumber(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const cleaned = String(raw)
    .replace(/[$,£€]/g, "")
    .trim();
  if (cleaned === "" || cleaned === "-") return null;
  const n = Number.parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

/**
 * Tolerant CSV parser — handles quoted fields with commas, escaped quotes,
 * and trailing newlines. We're not pulling in PapaParse for this since
 * Amazon's CSVs are simple and we'd rather avoid the dep.
 */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(cell);
        cell = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && input[i + 1] === "\n") i++;
        row.push(cell);
        cell = "";
        if (row.length > 0 && row.some((c) => c !== "")) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    if (row.length > 0 && row.some((c) => c !== "")) rows.push(row);
  }
  return rows;
}

export interface ParseResult {
  rows: ParsedAmazonRow[];
  /** Raw header → mapped logical field, for debugging. */
  headerMap: Record<string, string>;
  /** True when we found a subtag column. False = report won't attribute. */
  hasSubtagColumn: boolean;
  /** Total CSV rows processed (excluding header). */
  totalRows: number;
  /** Rows where the subtag wasn't a UUID — get bucketed for manual review. */
  skipped: Array<{ reason: string; raw: Record<string, string> }>;
}

export function parseAmazonReport(csv: string): ParseResult {
  const matrix = parseCsv(csv);
  if (matrix.length === 0) {
    return {
      rows: [],
      headerMap: {},
      hasSubtagColumn: false,
      totalRows: 0,
      skipped: [],
    };
  }

  const headers = matrix[0];
  const headerIndex = buildHeaderIndex(headers);
  const headerMap = Object.fromEntries(headerIndex.entries()) as Record<
    string,
    string
  >;
  const hasSubtagColumn = Array.from(headerIndex.values()).includes("subtag");

  const rows: ParsedAmazonRow[] = [];
  const skipped: ParseResult["skipped"] = [];

  for (let i = 1; i < matrix.length; i++) {
    const cells = matrix[i];
    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      raw[headers[j]] = cells[j] ?? "";
    }

    const get = (field: keyof ParsedAmazonRow): string | null => {
      const headerForField = Array.from(headerIndex.entries()).find(
        ([, f]) => f === field,
      )?.[0];
      if (!headerForField) return null;
      const v = raw[headerForField];
      return v != null && v !== "" && v !== "-" ? v : null;
    };

    const subtag = get("subtag");
    const rawStatus = get("rawStatus");
    const row: ParsedAmazonRow = {
      subtag: subtag ? subtag.trim() : null,
      transactionId: get("transactionId"),
      asin: get("asin"),
      productTitle: get("productTitle"),
      orderDate: get("orderDate"),
      saleAmount: parseNumber(get("saleAmount")),
      commissionTotal: parseNumber(get("commissionTotal")),
      rawStatus,
      status: mapStatus(rawStatus),
      trackingId: get("trackingId"),
    };

    // Validate subtag is a UUID before treating as ingest-eligible
    if (!row.subtag) {
      skipped.push({ reason: "no subtag column or empty", raw });
      continue;
    }
    if (!UUID_RE.test(row.subtag)) {
      skipped.push({
        reason: `subtag "${row.subtag}" not a UUID — likely aggregated row`,
        raw,
      });
      continue;
    }
    if (row.commissionTotal == null && row.saleAmount == null) {
      skipped.push({ reason: "no monetary value", raw });
      continue;
    }

    rows.push(row);
  }

  return {
    rows,
    headerMap,
    hasSubtagColumn,
    totalRows: matrix.length - 1,
    skipped,
  };
}

export { UUID_RE };
