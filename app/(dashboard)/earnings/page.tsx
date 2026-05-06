import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, DollarSign, MousePointerClick } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  fetchEarningsSummary,
  fetchRecentCommissions,
  fetchTopLooksByEarnings,
} from "@/lib/earnings/queries";
import {
  formatMoney,
  formatDate,
  statusLabel,
  statusColor,
} from "@/types/earnings";

export const metadata = { title: "Earnings" };

export default async function EarningsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [summary, recent, topLooks] = await Promise.all([
    fetchEarningsSummary(),
    fetchRecentCommissions(25),
    fetchTopLooksByEarnings(5),
  ]);

  const hasAnyData =
    summary.totalClicks > 0 ||
    summary.countsByStatus.pending > 0 ||
    summary.countsByStatus.confirmed > 0 ||
    summary.countsByStatus.paid > 0 ||
    summary.countsByStatus.rejected > 0;

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Earnings
      </p>
      <h1 className="font-display text-4xl">Your affiliate revenue.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Per-sale ledger from Amazon Creator Connections + any other affiliate
        networks you're connected through. Updates as commissions are
        ingested from network reports — typically a few days behind the sale.
      </p>

      <div className="mt-10 editorial-divider" />

      {!hasAnyData ? (
        <EmptyState />
      ) : (
        <>
          {/* Summary stat tiles */}
          <div className="mt-10 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Earned"
              value={formatMoney(summary.earned)}
              hint="Confirmed + paid"
              icon={<DollarSign size={14} strokeWidth={1.75} />}
              accent
            />
            <StatTile
              label="Paid out"
              value={formatMoney(summary.paid)}
              hint={`${summary.countsByStatus.paid} sales`}
            />
            <StatTile
              label="Confirmed"
              value={formatMoney(summary.confirmedUnpaid)}
              hint={`${summary.countsByStatus.confirmed} sales · awaiting payout`}
            />
            <StatTile
              label="Pending"
              value={formatMoney(summary.pending)}
              hint={`${summary.countsByStatus.pending} sales · in return window`}
            />
          </div>

          {/* Click + conversion stats */}
          <div className="mt-3 grid gap-3 grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Total clicks"
              value={summary.totalClicks.toLocaleString()}
              hint="Across all your looks"
              icon={<MousePointerClick size={14} strokeWidth={1.75} />}
            />
            <StatTile
              label="Conversion"
              value={`${(summary.conversionRate * 100).toFixed(2)}%`}
              hint="Sales / clicks"
            />
            <StatTile
              label="Avg / sale"
              value={
                summary.countsByStatus.confirmed +
                  summary.countsByStatus.paid >
                0
                  ? formatMoney(
                      summary.earned /
                        (summary.countsByStatus.confirmed +
                          summary.countsByStatus.paid),
                    )
                  : "—"
              }
              hint="Earned ÷ confirmed/paid sales"
            />
            <StatTile
              label="Returns"
              value={formatMoney(summary.rejectedAmount)}
              hint={`${summary.countsByStatus.rejected} reversed`}
            />
          </div>

          {/* Top earning looks */}
          {topLooks.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl">Top looks</h2>
              <p className="mt-1 text-sm text-muted">
                Looks driving the most commission revenue.
              </p>
              <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {topLooks.map((l, i) => (
                  <li
                    key={l.lookId}
                    className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3"
                  >
                    <div className="w-12 h-14 rounded-md bg-bg overflow-hidden shrink-0">
                      {l.coverPhotoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.coverPhotoUrl}
                          alt={l.title}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-muted">
                        #{i + 1}
                      </div>
                      <Link
                        href={`/looks/${l.lookId}`}
                        className="text-sm font-medium hover:text-rose truncate block"
                      >
                        {l.title || "Untitled look"}
                      </Link>
                      <div className="text-xs text-muted mt-0.5">
                        {l.count} sale{l.count === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div className="font-display text-lg shrink-0">
                      {formatMoney(l.total)}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Recent commissions table */}
          <section className="mt-12">
            <h2 className="font-display text-2xl">Recent commissions</h2>
            <p className="mt-1 text-sm text-muted">
              Last {recent.length} sale{recent.length === 1 ? "" : "s"}.
              Status reflects the network's review state.
            </p>

            <div className="mt-5 rounded-2xl border border-border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead className="text-[10px] uppercase tracking-widest text-muted bg-bg">
                  <tr>
                    <th className="text-left p-3 font-normal">Date</th>
                    <th className="text-left p-3 font-normal">Look</th>
                    <th className="text-left p-3 font-normal">Item</th>
                    <th className="text-left p-3 font-normal">Network</th>
                    <th className="text-right p-3 font-normal">Sale</th>
                    <th className="text-right p-3 font-normal">Earned</th>
                    <th className="text-left p-3 font-normal">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((c) => (
                    <tr
                      key={c.id}
                      className="border-t border-border align-top"
                    >
                      <td className="p-3 text-xs text-muted whitespace-nowrap">
                        {formatDate(c.orderDate ?? c.createdAt)}
                      </td>
                      <td className="p-3">
                        {c.lookId ? (
                          <Link
                            href={`/looks/${c.lookId}`}
                            className="hover:text-rose truncate block max-w-[180px]"
                          >
                            {c.lookTitle || "—"}
                          </Link>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        {c.itemName || c.itemBrand ? (
                          <div className="max-w-[180px]">
                            {c.itemBrand ? (
                              <div className="text-[10px] uppercase tracking-widest text-muted truncate">
                                {c.itemBrand}
                              </div>
                            ) : null}
                            <div className="truncate">{c.itemName ?? "—"}</div>
                          </div>
                        ) : c.merchantName ? (
                          <span className="text-muted">{c.merchantName}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="p-3 text-xs text-muted capitalize">
                        {c.affiliateNetwork ?? "—"}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        {formatMoney(c.saleAmount)}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap font-medium">
                        {formatMoney(
                          c.creatorShare ?? c.commissionTotal,
                        )}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-widest border ${statusColor(c.status)}`}
                        >
                          {statusLabel(c.status)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs text-muted">
              Showing the {recent.length} most-recent sales. Earlier history
              available on the affiliate network's own dashboard.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
  accent,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${accent ? "border-rose bg-rose/5" : "border-border bg-card"}`}
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-3xl">{value}</div>
      {hint ? (
        <div className="mt-1 text-xs text-muted leading-snug">{hint}</div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-12 rounded-2xl border border-border bg-card p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-full bg-bg flex items-center justify-center mb-5">
        <DollarSign size={20} strokeWidth={1.5} className="text-rose" />
      </div>
      <h2 className="font-display text-2xl">No commissions yet.</h2>
      <p className="mt-3 text-sm text-muted max-w-md mx-auto leading-relaxed">
        Once shoppers click through your shop links and complete purchases,
        the affiliate network will report sales back and your earnings will
        appear here. Updates land a few days behind each sale.
      </p>
      <Link
        href="/looks/new"
        className="inline-flex items-center justify-center gap-1 mt-6 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Publish a new look
        <ArrowUpRight size={14} strokeWidth={2} />
      </Link>
    </div>
  );
}
