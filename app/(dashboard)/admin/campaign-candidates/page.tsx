import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/admin/auth";
import {
  listPendingCandidates,
  type CandidateFilter,
} from "@/lib/campaigns/candidates-queries";
import { cn } from "@/lib/cn";
import { CampaignCandidatesList } from "./CampaignCandidatesList";

export const metadata = { title: "Campaign queue · Admin" };

// Always fetch fresh — admin lists shouldn't be statically cached.
export const dynamic = "force-dynamic";

const FILTERS: { key: CandidateFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "fashion", label: "Fashion" },
  { key: "accessory", label: "Accessories" },
  { key: "unsure", label: "Unsure" },
  { key: "non_fashion", label: "Non-fashion" },
];

function parseFilter(v: string | undefined): CandidateFilter {
  return v === "fashion" ||
    v === "accessory" ||
    v === "non_fashion" ||
    v === "unsure"
    ? v
    : "all";
}

export default async function AdminCampaignCandidatesPage({
  searchParams,
}: {
  searchParams: { f?: string };
}) {
  if (!(await isAdmin())) redirect("/");

  const filter = parseFilter(searchParams?.f);
  const { candidates, filterTotal, shown, counts, excludedCategories } =
    await listPendingCandidates(filter);

  const countFor = (k: CandidateFilter) =>
    k === "all" ? counts.total : counts[k];

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Amazon bonus queue
      </p>

      <div>
        <h1 className="font-display text-4xl">Campaign queue.</h1>
        <p className="mt-3 text-muted leading-relaxed max-w-prose">
          Amazon-bonus-eligible products, auto-discovered daily and sorted by a
          learner that sharpens every time you approve or deny. Color and size
          variants roll up into one card — approving covers every ASIN, and
          creators see a single product. Each approval becomes a campaign in the
          Bonuses bucket. You still opt in on Amazon Creator Connections and
          paste the share URL on the campaign so commissions attribute.
        </p>
        {excludedCategories.length > 0 ? (
          <p className="mt-2 text-xs text-muted">
            Hidden departments: {excludedCategories.join(" · ")}
          </p>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={f.key === "all" ? "?" : `?f=${f.key}`}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                active
                  ? "bg-rose text-white border-rose"
                  : "border-border text-text hover:border-rose",
              )}
            >
              {f.label}
              <span
                className={cn(
                  "ml-1.5",
                  active ? "text-white/80" : "text-muted",
                )}
              >
                {countFor(f.key).toLocaleString()}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 editorial-divider" />

      <div className="mt-6">
        {candidates.length === 0 ? (
          <EmptyState filter={filter} />
        ) : (
          <CampaignCandidatesList
            candidates={candidates}
            filter={filter}
            bulkCount={counts.non_fashion}
          />
        )}
      </div>

      {shown < filterTotal ? (
        <p className="mt-6 text-xs text-muted">
          Showing newest {shown.toLocaleString()} of{" "}
          {filterTotal.toLocaleString()}.
        </p>
      ) : null}
    </div>
  );
}

function EmptyState({ filter }: { filter: CandidateFilter }) {
  const msg =
    filter === "all"
      ? "No Amazon-bonus products waiting for review. The discovery run refreshes this daily."
      : `Nothing in the “${filter.replace("_", "-")}” bucket right now. Try another filter.`;
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-2xl">Queue&apos;s clear.</p>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        {msg}
      </p>
    </div>
  );
}
