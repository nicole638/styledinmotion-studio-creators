import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { listPendingCandidates } from "@/lib/campaigns/candidates-queries";
import { CampaignCandidatesList } from "./CampaignCandidatesList";

export const metadata = { title: "Campaign queue · Admin" };

// Always fetch fresh — admin lists shouldn't be statically cached.
export const dynamic = "force-dynamic";

export default async function AdminCampaignCandidatesPage() {
  if (!(await isAdmin())) redirect("/");

  const { candidates, total, shown } = await listPendingCandidates();

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Amazon bonus queue
      </p>

      <div>
        <h1 className="font-display text-4xl">Campaign queue.</h1>
        <p className="mt-3 text-muted leading-relaxed max-w-prose">
          Amazon-bonus-eligible products, auto-discovered daily. Approve the
          ones you and Kerri want to run — each becomes a campaign in the
          Bonuses bucket. You still opt in on Amazon Creator Connections and
          paste the share URL on the campaign so commissions attribute. Items
          age out of the queue automatically when their bonus ends.
        </p>
      </div>

      <div className="mt-10 editorial-divider" />

      {total > 0 ? (
        <p className="mt-8 text-xs uppercase tracking-[0.2em] text-muted">
          {total.toLocaleString()} pending
          {shown < total ? ` · showing newest ${shown.toLocaleString()}` : ""}
        </p>
      ) : null}

      <div className="mt-4">
        {candidates.length === 0 ? (
          <EmptyState />
        ) : (
          <CampaignCandidatesList candidates={candidates} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-2xl">Queue&apos;s clear.</p>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        No new Amazon-bonus products waiting for review. The discovery run
        refreshes this daily — check back, or approve from here as they land.
      </p>
    </div>
  );
}
