import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, DollarSign, MousePointerClick, Wallet, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import {
  fetchEarningsSummary,
  fetchRecentCommissions,
  fetchTopLooksByEarnings,
  fetchLookPerformance,
  fetchItemPerformance,
  fetchClicksByNetwork,
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

  const [
    summary,
    recent,
    topLooks,
    lookPerf,
    itemPerf,
    networkMix,
    { data: profile },
  ] = await Promise.all([
    fetchEarningsSummary(),
    fetchRecentCommissions(25),
    fetchTopLooksByEarnings(5),
    fetchLookPerformance(),
    fetchItemPerformance(),
    fetchClicksByNetwork(),
    // Fetch payout_email so we can surface a nudge banner when commissions
    // exist but no payment method is set — same UX as iOS dashboard banner.
    supabase
      .from("creator_profiles")
      .select("payout_email")
      .eq("creator_id", user.id)
      .maybeSingle(),
  ]);

  const hasCommissions =
    summary.countsByStatus.pending +
      summary.countsByStatus.confirmed +
      summary.countsByStatus.paid >
    0;
  const needsPayoutSetup =
    hasCommissions &&
    (!profile?.payout_email || profile.payout_email.trim() === "");

  const hasAnyData =
    summary.totalClicks > 0 ||
    summary.countsByStatus.pending > 0 ||
    summary.countsByStatus.confirmed > 0 ||
    summary.countsByStatus.paid > 0 ||
    summary.countsByStatus.rejected > 0;

  // In-between state: creator has driven clicks but Amazon hasn't reported
  // any commissions yet. Typical lag is 1-14 days from click to confirmed
  // sale; for newly-active creators or fresh API integrations the whole
  // table can sit at zero for weeks. Surface what they DO have (click
  // activity) so the page doesn't read as "you've earned nothing."
  const hasClicksButNoSales =
    summary.totalClicks > 0 && !hasCommissions;

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

      {needsPayoutSetup ? (
        <Link
          href="/profile#payments"
          className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-rose/40 bg-rose/5 px-5 py-4 hover:bg-rose/10 transition-colors group"
        >
          <div className="flex items-start gap-3 min-w-0">
            <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full bg-rose text-white">
              <Wallet size={16} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                You&apos;ve earned commissions — set up how you get paid.
              </p>
              <p className="text-xs text-muted mt-0.5">
                Add your PayPal email so we can release your confirmed
                balance once it crosses $25.
              </p>
            </div>
          </div>
          <ArrowUpRight
            size={16}
            strokeWidth={2}
            className="shrink-0 text-rose group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform"
          />
        </Link>
      ) : null}

      {hasClicksButNoSales ? (
        <div className="mt-8 rounded-2xl border border-border bg-card px-5 py-4 flex items-start gap-3">
          <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-9 h-9 rounded-full bg-bg border border-border">
            <Clock size={16} strokeWidth={1.75} className="text-rose" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {summary.totalClicks.toLocaleString()} click
              {summary.totalClicks === 1 ? "" : "s"} so far — no purchases
              reported yet.
            </p>
            <p className="mt-1 text-xs text-muted leading-relaxed">
              Commissions show up 1–14 days after a shopper completes their
              order. Amazon confirms via daily reports; clicks from this
              week typically post by next week. Looks driving clicks are
              doing exactly what they should.
            </p>
          </div>
        </div>
      ) : null}

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

          {/* Per-look performance table — every published look with its
              clicks + earnings + commission count. Ordered by clicks desc
              server-side; visually highlights the $/click ratio so creators
              can spot looks that need a stronger CTA. */}
          {lookPerf.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl">Performance by look</h2>
              <p className="mt-1 text-sm text-muted">
                Every published look you have, ranked by total clicks.
                $/click is gross commission earned per click event — useful
                for spotting low-converting items.
              </p>
              <div className="mt-5 rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bg/60 border-b border-border">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted">
                      <th className="px-4 py-3 w-12"></th>
                      <th className="px-4 py-3">Look</th>
                      <th className="px-4 py-3 text-right">Pieces</th>
                      <th className="px-4 py-3 text-right">Clicks</th>
                      <th className="px-4 py-3 text-right">Sales</th>
                      <th className="px-4 py-3 text-right">$ Earned</th>
                      <th className="px-4 py-3 text-right">$/click</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookPerf.map((row) => {
                      const dollarsPerClick =
                        row.clicks > 0 ? row.earnings / row.clicks : 0;
                      return (
                        <tr
                          key={row.lookId}
                          className="border-b border-border last:border-b-0 hover:bg-bg/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="w-10 h-12 rounded-md bg-bg overflow-hidden">
                              {row.coverPhotoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={row.coverPhotoUrl}
                                  alt={row.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/looks/${row.lookId}`}
                              className="font-medium hover:text-rose"
                            >
                              {row.title}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted">
                            {row.itemCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.clicks.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted">
                            {row.commissionCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {row.earnings > 0
                              ? formatMoney(row.earnings)
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted">
                            {dollarsPerClick > 0
                              ? `$${dollarsPerClick.toFixed(2)}`
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* Traffic by network — buckets every real shopper click + commission
              by the affiliate network that handled it. Empty buckets (e.g.
              CJ before any CJ click has happened) are simply omitted by
              the RPC, so the card scales from 0 → N networks without empty
              rows. */}
          {networkMix.length > 0 ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl">Traffic by network</h2>
              <p className="mt-1 text-sm text-muted">
                Where your clicks land before they hit the merchant.
                Unaffiliated = clicks on merchants we don&apos;t yet wrap.
              </p>
              <ul className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {networkMix.map((row) => {
                  const label =
                    row.network === "amazon"
                      ? "Amazon"
                      : row.network === "awin"
                        ? "Awin"
                        : row.network === "cj"
                          ? "CJ"
                          : "Unaffiliated";
                  return (
                    <li
                      key={row.network}
                      className="rounded-2xl border border-border bg-card p-4"
                    >
                      <p className="text-[10px] uppercase tracking-widest text-muted">
                        {label}
                      </p>
                      <p className="mt-2 font-display text-2xl tabular-nums">
                        {row.clicks.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted">
                        {row.clicks === 1 ? "click" : "clicks"}
                      </p>
                      {row.earnings > 0 ? (
                        <p className="mt-2 text-sm text-rose font-medium tabular-nums">
                          {formatMoney(row.earnings)} earned
                        </p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {/* Per-item performance — every closet item ranked by clicks. Powered
              by creator_item_performance RPC (server-side aggregation across
              click_events × look_items × commissions). Shows up only when
              there's at least one item with clicks; cleaner than rendering
              an empty "no items" table. */}
          {itemPerf.length > 0 && itemPerf.some((r) => r.clicks > 0) ? (
            <section className="mt-12">
              <h2 className="font-display text-2xl">Performance by item</h2>
              <p className="mt-1 text-sm text-muted">
                Your closet, ranked by clicks. Use this to see which pieces
                shoppers gravitate toward and which deserve a fresh look.
              </p>
              <div className="mt-5 rounded-2xl border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-bg/60 border-b border-border">
                    <tr className="text-left text-xs uppercase tracking-wider text-muted">
                      <th className="px-4 py-3 w-12"></th>
                      <th className="px-4 py-3">Item</th>
                      <th className="px-4 py-3">Brand</th>
                      <th className="px-4 py-3 text-right">In looks</th>
                      <th className="px-4 py-3 text-right">Clicks</th>
                      <th className="px-4 py-3 text-right">Sales</th>
                      <th className="px-4 py-3 text-right">$ Earned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemPerf
                      .filter((row) => row.clicks > 0)
                      .slice(0, 25)
                      .map((row) => (
                        <tr
                          key={row.itemId}
                          className="border-b border-border last:border-b-0 hover:bg-bg/30 transition-colors"
                        >
                          <td className="px-4 py-3">
                            <div className="w-10 h-12 rounded-md bg-bg overflow-hidden">
                              {row.photoUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={row.photoUrl}
                                  alt={row.name ?? ""}
                                  className="w-full h-full object-contain p-1"
                                />
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/closet/${row.itemId}`}
                              className="font-medium hover:text-rose truncate block max-w-[18ch]"
                            >
                              {row.name ?? "Untitled piece"}
                            </Link>
                            {row.category ? (
                              <span className="text-xs text-muted">
                                {row.category}
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-muted truncate max-w-[14ch]">
                            {row.brand ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted">
                            {row.looksCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            {row.clicks.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums text-muted">
                            {row.commissionCount}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums font-medium">
                            {row.earnings > 0 ? formatMoney(row.earnings) : "—"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {itemPerf.filter((r) => r.clicks > 0).length > 25 ? (
                  <p className="px-4 py-3 text-xs text-muted border-t border-border">
                    Showing top 25 by clicks. Full export coming soon.
                  </p>
                ) : null}
              </div>
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
      <h2 className="font-display text-2xl">No clicks or sales yet.</h2>
      <p className="mt-3 text-sm text-muted max-w-md mx-auto leading-relaxed">
        Publish a look, share it with your audience, and click activity
        will start flowing in here. When a shopper purchases, the
        commission lands 1–14 days later — that&apos;s how long Amazon
        takes to confirm.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/looks/new"
          className="inline-flex items-center justify-center gap-1 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Publish a new look
          <ArrowUpRight size={14} strokeWidth={2} />
        </Link>
        <Link
          href="/profile#payments"
          className="inline-flex items-center justify-center gap-1 rounded-full border border-border bg-bg px-5 py-2.5 text-sm hover:border-rose transition-colors"
        >
          Set up payment
        </Link>
      </div>
    </div>
  );
}
