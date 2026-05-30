import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import {
  getClickTotals,
  getCreatorClicks,
  getMerchantClicks,
  getNetworkBreakdown,
  getSourceBreakdown,
  getSuspectedLoggingGaps,
  type CreatorClicks,
  type MerchantClicks,
  type NetworkBreakdown,
  type SourceBreakdown,
  type MerchantGap,
} from "@/lib/admin/click-analytics";

export const metadata = { title: "Click analytics · Admin" };
export const dynamic = "force-dynamic";

const CJ_DOMAINS = new Set([
  "camper.com",
  "us.camper.com",
  "mytheresa.com",
  "quay.com",
  "quayaustralia.com",
  "rebag.com",
]);

export default async function AdminClickAnalyticsPage() {
  if (!(await isAdmin())) redirect("/");

  const [totals, creators, merchants, networks, sources, gaps] =
    await Promise.all([
      getClickTotals(),
      getCreatorClicks(),
      getMerchantClicks(),
      getNetworkBreakdown(),
      getSourceBreakdown(),
      getSuspectedLoggingGaps(),
    ]);

  const total30 = totals.clicks_30d || 1; // avoid divide-by-zero in pct
  const gapsByZero = gaps.filter((g) => g.clicks_30d === 0);
  const cjGaps = gapsByZero.filter(
    (g) => g.network === "cj" || (g.domain && CJ_DOMAINS.has(g.domain)),
  );
  const unknownSource =
    sources.find((s) => s.source === "unknown")?.clicks_30d ?? 0;
  const sourcedSplit = sources.filter((s) => s.source !== "unknown");

  return (
    <div className="max-w-6xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Click analytics
      </p>

      <h1 className="font-display text-4xl">Where clicks actually land.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Every row in <code className="text-text">click_events</code> over the
        last 30 days, sliced six ways. Use the Suspected logging gaps section
        to spot merchants whose catalog is live but whose clicks aren&apos;t
        being captured — the most likely cause is a write path that bypasses{" "}
        <code className="text-text">/api/shop</code> on the website.
      </p>

      {/* Top-line totals */}
      <section className="mt-10 grid grid-cols-3 gap-4">
        <Stat label="Last 7 days" value={totals.clicks_7d} />
        <Stat label="Last 30 days" value={totals.clicks_30d} />
        <Stat label="Last 90 days" value={totals.clicks_90d} />
      </section>

      {/* Source split */}
      <div className="mt-12 editorial-divider" />
      <section className="mt-10">
        <h2 className="font-display text-2xl mb-2">Source split (30d)</h2>
        <p className="text-sm text-muted mb-4 max-w-prose">
          The <code className="text-text">source</code> column was added on
          2026-05-30. Rows logged before then show as &ldquo;unknown&rdquo;
          because no write path was setting it yet. Once Vibecode (iOS) and{" "}
          <code className="text-text">/api/shop</code> (web) start writing the
          column, the unknown bucket will drain and you&apos;ll see a real
          web-vs-iOS split.
        </p>
        <SourceTable rows={sources} total={total30} />
        {unknownSource === totals.clicks_30d && (
          <p className="text-sm text-rose mt-3">
            All 30d clicks are still &ldquo;unknown&rdquo; — neither write path
            has shipped the source field yet. File Vibecode + Hono prompts.
          </p>
        )}
        {sourcedSplit.length > 0 && (
          <p className="text-sm text-muted mt-3">
            {sourcedSplit.length} click{sourcedSplit.length === 1 ? "" : "s"}{" "}
            tagged so far — the split is coming online.
          </p>
        )}
      </section>

      {/* Network breakdown */}
      <div className="mt-12 editorial-divider" />
      <section className="mt-10">
        <h2 className="font-display text-2xl mb-2">By affiliate network (30d)</h2>
        <p className="text-sm text-muted mb-4 max-w-prose">
          Anything in <code className="text-text">unaffiliated</code> is a
          click on a retailer where we don&apos;t have an affiliate
          relationship — no commission, but useful signal for which brands to
          chase.
        </p>
        <NetworkTable rows={networks} total={total30} />
      </section>

      {/* Per creator */}
      <div className="mt-12 editorial-divider" />
      <section className="mt-10">
        <h2 className="font-display text-2xl mb-2">By creator (90d)</h2>
        <p className="text-sm text-muted mb-4 max-w-prose">
          What each creator&apos;s in-app Performance card shows. The
          unaffiliated column reveals how much of their traffic is going to
          retailers we can&apos;t monetize.
        </p>
        <CreatorTable rows={creators} />
      </section>

      {/* Per merchant */}
      <div className="mt-12 editorial-divider" />
      <section className="mt-10">
        <h2 className="font-display text-2xl mb-2">By merchant (30d)</h2>
        <MerchantTable rows={merchants} />
      </section>

      {/* Suspected logging gaps */}
      <div className="mt-12 editorial-divider" />
      <section className="mt-10">
        <h2 className="font-display text-2xl mb-2">
          Suspected logging gaps ({gapsByZero.length})
        </h2>
        <p className="text-sm text-muted mb-4 max-w-prose">
          Active merchants with a populated catalog but{" "}
          <strong>zero clicks in 30 days</strong>. Could mean nobody&apos;s
          surfaced the brand yet — or that web clicks are silently being
          dropped. CJ rows are <em>expected</em> to be 0 until{" "}
          <code className="text-text">/api/shop</code> stops bypassing
          kqzyfj.com URLs.
        </p>
        {cjGaps.length > 0 && (
          <div className="mb-6 rounded-2xl border border-rose/30 bg-rose/5 p-4">
            <p className="text-sm font-medium text-rose">
              {cjGaps.length} CJ merchant{cjGaps.length === 1 ? "" : "s"} with
              0 clicks — known web-side bypass.
            </p>
            <p className="text-xs text-muted mt-1">
              {cjGaps
                .map((g) => `${g.merchant_name} (${g.product_count.toLocaleString()})`)
                .join(" · ")}
            </p>
          </div>
        )}
        <MerchantGapTable rows={gapsByZero} />
      </section>

      <div className="mt-16 mb-12 rounded-2xl border border-border bg-card p-6">
        <h3 className="font-display text-xl">Known gaps in the write path</h3>
        <ol className="mt-3 space-y-2 text-sm text-text list-decimal pl-5">
          <li>
            <strong>Web bypasses CJ.</strong>{" "}
            <code className="text-muted">web/lib/affiliate.ts</code> hands
            kqzyfj.com URLs straight to the browser instead of routing through{" "}
            <code className="text-muted">/api/shop</code>, so no row is
            written. Fix: route every product click through{" "}
            <code className="text-muted">/api/shop</code> on the Hono backend
            and have it 302 to already-wrapped URLs.
          </li>
          <li>
            <strong>Web drops unaffiliated retailers.</strong> Same file
            passes Target / Zara / Adidas / Free People links through raw.
            iOS app logs these. Fix above closes this hole too.
          </li>
          <li>
            <strong>Historical rows have no source.</strong> The{" "}
            <code className="text-muted">source</code> column went in on
            2026-05-30; until Vibecode and Hono ship the field, every new
            click still shows up as &ldquo;unknown&rdquo;.
          </li>
        </ol>
      </div>
    </div>
  );
}

/* ---------- presentation ---------- */

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="font-display text-4xl mt-2">{value.toLocaleString()}</p>
    </div>
  );
}

function pct(n: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((n / total) * 100)}%`;
}

function SourceTable({
  rows,
  total,
}: {
  rows: SourceBreakdown[];
  total: number;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted">No clicks in the last 30 days.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-widest text-muted">
        <tr>
          <th className="py-2">Source</th>
          <th className="py-2 text-right">Clicks (30d)</th>
          <th className="py-2 text-right">Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.source} className="border-t border-border">
            <td className="py-2.5 capitalize">{r.source}</td>
            <td className="py-2.5 text-right">
              {r.clicks_30d.toLocaleString()}
            </td>
            <td className="py-2.5 text-right text-muted">
              {pct(r.clicks_30d, total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function NetworkTable({
  rows,
  total,
}: {
  rows: NetworkBreakdown[];
  total: number;
}) {
  if (rows.length === 0)
    return <p className="text-sm text-muted">No clicks in the last 30 days.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-widest text-muted">
        <tr>
          <th className="py-2">Network</th>
          <th className="py-2 text-right">Clicks (30d)</th>
          <th className="py-2 text-right">Creators</th>
          <th className="py-2 text-right">Share</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.affiliate_network} className="border-t border-border">
            <td className="py-2.5 capitalize">{r.affiliate_network}</td>
            <td className="py-2.5 text-right">
              {r.clicks_30d.toLocaleString()}
            </td>
            <td className="py-2.5 text-right text-muted">
              {r.creators.toLocaleString()}
            </td>
            <td className="py-2.5 text-right text-muted">
              {pct(r.clicks_30d, total)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CreatorTable({ rows }: { rows: CreatorClicks[] }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted">No creators with clicks yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-widest text-muted">
        <tr>
          <th className="py-2">Creator</th>
          <th className="py-2 text-right">7d</th>
          <th className="py-2 text-right">30d</th>
          <th className="py-2 text-right">Affiliated (30d)</th>
          <th className="py-2 text-right">Unaffiliated (30d)</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.creator_id} className="border-t border-border">
            <td className="py-2.5">{r.creator_label}</td>
            <td className="py-2.5 text-right">{r.c7.toLocaleString()}</td>
            <td className="py-2.5 text-right">{r.c30.toLocaleString()}</td>
            <td className="py-2.5 text-right text-muted">
              {r.c30_affil.toLocaleString()}
            </td>
            <td className="py-2.5 text-right text-muted">
              {r.c30_unaffil.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MerchantTable({ rows }: { rows: MerchantClicks[] }) {
  if (rows.length === 0)
    return <p className="text-sm text-muted">No merchants with clicks yet.</p>;
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-widest text-muted">
        <tr>
          <th className="py-2">Merchant</th>
          <th className="py-2">Network</th>
          <th className="py-2 text-right">Clicks (30d)</th>
          <th className="py-2 text-right">Creators</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 30).map((r) => (
          <tr
            key={`${r.merchant_domain}-${r.affiliate_network ?? "_"}`}
            className="border-t border-border"
          >
            <td className="py-2.5">{r.merchant_domain ?? "—"}</td>
            <td className="py-2.5 text-muted capitalize">
              {r.affiliate_network ?? "unaffiliated"}
            </td>
            <td className="py-2.5 text-right">
              {r.clicks_30d.toLocaleString()}
            </td>
            <td className="py-2.5 text-right text-muted">
              {r.creators.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MerchantGapTable({ rows }: { rows: MerchantGap[] }) {
  if (rows.length === 0)
    return (
      <p className="text-sm text-muted">
        Every active merchant with a catalog received at least one click in
        the last 30 days. Logging looks healthy.
      </p>
    );
  return (
    <table className="w-full text-sm">
      <thead className="text-left text-xs uppercase tracking-widest text-muted">
        <tr>
          <th className="py-2">Merchant</th>
          <th className="py-2">Network</th>
          <th className="py-2 text-right">Products</th>
          <th className="py-2 text-right">Clicks (30d)</th>
        </tr>
      </thead>
      <tbody>
        {rows.slice(0, 40).map((r) => (
          <tr key={r.merchant_id} className="border-t border-border">
            <td className="py-2.5">
              <div>{r.merchant_name}</div>
              <div className="text-xs text-muted">{r.domain}</div>
            </td>
            <td className="py-2.5 text-muted uppercase text-xs">{r.network}</td>
            <td className="py-2.5 text-right">
              {r.product_count.toLocaleString()}
            </td>
            <td className="py-2.5 text-right">
              {r.clicks_30d.toLocaleString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
