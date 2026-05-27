import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import {
  listBrandPartnerships,
  listPriorityCreators,
  type BrandPartnership,
  type PriorityCreator,
} from "@/lib/brand-partnerships/queries";

export const metadata = { title: "Brand partnerships · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminBrandPartnershipsPage() {
  if (!(await isAdmin())) redirect("/");

  const [partnerships, priorityCreators] = await Promise.all([
    listBrandPartnerships(),
    listPriorityCreators(),
  ]);

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Brand partnerships
      </p>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Paid brand campaigns.</h1>
          <p className="mt-3 text-muted leading-relaxed max-w-prose">
            Track sponsored partnerships and the creators you offer them
            to. Founding Creators get permanent priority. Anyone whose
            referred creator has published 3+ looks gets a 90-day priority
            window. The list below is the current cohort eligible to be
            offered first.
          </p>
        </div>
        <Link
          href="/admin/brand-partnerships/new"
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          + New campaign
        </Link>
      </div>

      <div className="mt-10 editorial-divider" />

      <section className="mt-10">
        <h2 className="font-display text-2xl mb-4">
          Campaigns ({partnerships.length})
        </h2>
        {partnerships.length === 0 ? (
          <EmptyPartnerships />
        ) : (
          <PartnershipsTable partnerships={partnerships} />
        )}
      </section>

      <div className="mt-16 editorial-divider" />

      <section className="mt-10">
        <h2 className="font-display text-2xl mb-1">
          Priority creators — offer these first
        </h2>
        <p className="text-sm text-muted mb-6">
          {priorityCreators.length} creator
          {priorityCreators.length === 1 ? "" : "s"} currently in priority
          status.
        </p>
        {priorityCreators.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-muted text-sm">
            No priority creators yet. Founding Creators auto-qualify;
            referrers + referreds auto-qualify when the referred publishes
            their 3rd look.
          </p>
        ) : (
          <PriorityCreatorsTable creators={priorityCreators} />
        )}
      </section>
    </div>
  );
}

function PartnershipsTable({
  partnerships,
}: {
  partnerships: BrandPartnership[];
}) {
  return (
    <div className="overflow-hidden border border-border rounded-2xl bg-card">
      <table className="w-full text-sm">
        <thead className="bg-bg text-left">
          <tr>
            <Th>Brand</Th>
            <Th>Campaign</Th>
            <Th>Status</Th>
            <Th className="text-right">Payout / creator</Th>
            <Th className="text-right">Offers</Th>
            <Th className="text-right">Accepted</Th>
            <Th>Dates</Th>
          </tr>
        </thead>
        <tbody>
          {partnerships.map((p) => (
            <tr
              key={p.id}
              className="border-t border-border hover:bg-bg/50 transition"
            >
              <Td className="font-medium">{p.brand_name}</Td>
              <Td>{p.campaign_name}</Td>
              <Td>
                <StatusPill status={p.status} />
              </Td>
              <Td className="text-right tabular-nums">
                {p.payout_per_creator
                  ? `${p.payout_currency} ${Number(p.payout_per_creator).toLocaleString()}`
                  : "—"}
              </Td>
              <Td className="text-right tabular-nums">{p.offer_count}</Td>
              <Td className="text-right tabular-nums">
                {p.accepted_count}
                {p.max_creators ? ` / ${p.max_creators}` : ""}
              </Td>
              <Td className="text-muted text-xs">
                {formatDateRange(p.starts_at, p.ends_at)}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PriorityCreatorsTable({
  creators,
}: {
  creators: PriorityCreator[];
}) {
  return (
    <div className="overflow-hidden border border-border rounded-2xl bg-card">
      <table className="w-full text-sm">
        <thead className="bg-bg text-left">
          <tr>
            <Th>Creator</Th>
            <Th>Reason</Th>
            <Th className="text-right">Followers</Th>
            <Th className="text-right">Days remaining</Th>
          </tr>
        </thead>
        <tbody>
          {creators.map((c) => (
            <tr
              key={c.creator_id}
              className="border-t border-border hover:bg-bg/50 transition"
            >
              <Td className="font-medium">
                {c.first_name ? `${c.first_name} ` : ""}
                <span className="text-muted">
                  @{c.username ?? "—"}
                </span>
              </Td>
              <Td>
                <ReasonPill reason={c.priority_reason ?? ""}>
                  {c.priority_reason_human}
                </ReasonPill>
              </Td>
              <Td className="text-right tabular-nums">
                {c.follower_count?.toLocaleString() ?? "—"}
              </Td>
              <Td className="text-right tabular-nums text-muted">
                {c.days_remaining === null
                  ? "permanent"
                  : `${c.days_remaining}d`}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyPartnerships() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-2xl">No campaigns yet.</p>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        Create the first brand partnership campaign here. Once it&apos;s
        open, offer it to priority creators below.
      </p>
      <Link
        href="/admin/brand-partnerships/new"
        className="inline-flex items-center gap-2 mt-6 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Create the first campaign
      </Link>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const color =
    status === "live"
      ? "bg-green-100 text-green-800"
      : status === "open"
        ? "bg-blue-100 text-blue-800"
        : status === "filled"
          ? "bg-purple-100 text-purple-800"
          : status === "completed"
            ? "bg-gray-100 text-gray-700"
            : status === "cancelled"
              ? "bg-red-100 text-red-800"
              : "bg-yellow-100 text-yellow-800"; // draft
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {status}
    </span>
  );
}

function ReasonPill({
  reason,
  children,
}: {
  reason: string;
  children: React.ReactNode;
}) {
  const color =
    reason === "founding_creator"
      ? "bg-rose/15 text-rose"
      : reason === "referrer"
        ? "bg-blue-50 text-blue-700"
        : "bg-green-50 text-green-700";
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {children}
    </span>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`text-xs uppercase tracking-wider text-muted font-medium px-4 py-3 ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function formatDateRange(starts: string | null, ends: string | null) {
  if (!starts && !ends) return "—";
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  if (starts && ends) return `${fmt(starts)} – ${fmt(ends)}`;
  if (starts) return `from ${fmt(starts)}`;
  return `until ${fmt(ends!)}`;
}
