/**
 * Creator earnings shape served to the /earnings dashboard.
 *
 * `commissions` stores the per-sale ledger. Status flow mirrors how
 * Amazon's Associates report progresses each line item:
 *   pending   — sale recorded, return window not yet expired
 *   confirmed — review window passed, commission earned, not yet paid
 *   paid      — payout sent
 *   rejected  — return / cancellation, commission reversed
 */

export type CommissionStatus = "pending" | "confirmed" | "paid" | "rejected";

export interface CommissionRow {
  id: string;
  affiliateNetwork: string | null;
  affiliateTransactionId: string | null;
  merchantName: string | null;
  merchantDomain: string | null;
  /** numeric-as-string; format on render via formatMoney */
  saleAmount: string | null;
  commissionTotal: string | null;
  creatorShare: string | null;
  status: CommissionStatus;
  orderDate: string | null;
  confirmedAt: string | null;
  paidAt: string | null;
  createdAt: string;
  /** Joined from click_events → looks/look_items for context */
  lookId: string | null;
  lookTitle: string | null;
  lookCoverPhotoUrl: string | null;
  itemName: string | null;
  itemBrand: string | null;
}

export interface EarningsSummary {
  /** Total commission_total summed across all rows (regardless of status) */
  total: number;
  /** Just the rows where the creator actually nets money — confirmed + paid */
  earned: number;
  /** What's been paid out so far */
  paid: number;
  /** Confirmed but not yet paid */
  confirmedUnpaid: number;
  /** Awaiting return-window expiration */
  pending: number;
  /** Returns / cancellations (negative-sign in the report) */
  rejectedAmount: number;
  countsByStatus: Record<CommissionStatus, number>;
  /** Total clicks logged on this creator's items in the period (or all-time) */
  totalClicks: number;
  /** Click → sale conversion rate (commissions / clicks) */
  conversionRate: number;
}

export function formatMoney(raw: string | number | null): string {
  if (raw == null || raw === "") return "$0.00";
  const n = typeof raw === "number" ? raw : Number.parseFloat(raw);
  if (Number.isNaN(n)) return "$0.00";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(n);
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}

export function statusLabel(status: CommissionStatus): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "confirmed":
      return "Confirmed";
    case "paid":
      return "Paid";
    case "rejected":
      return "Rejected";
  }
}

export function statusColor(status: CommissionStatus): string {
  switch (status) {
    case "pending":
      return "text-muted bg-card border-border";
    case "confirmed":
      return "text-text bg-card border-border";
    case "paid":
      return "text-rose bg-rose/10 border-rose/30";
    case "rejected":
      return "text-[#B53D2A] bg-[#FBE9E5] border-[#F4C7BF]";
  }
}
