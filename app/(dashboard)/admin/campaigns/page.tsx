import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { listCampaignsForAdmin } from "@/lib/campaigns/queries";
import { CampaignsList } from "./CampaignsList";

export const metadata = { title: "Campaigns · Admin" };

// Always fetch fresh — admin lists shouldn't be statically cached.
export const dynamic = "force-dynamic";

export default async function AdminCampaignsPage() {
  if (!(await isAdmin())) redirect("/");

  const campaigns = await listCampaignsForAdmin();

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Brand campaigns
      </p>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Creator Connections.</h1>
          <p className="mt-3 text-muted leading-relaxed max-w-prose">
            Brand campaigns the platform has opted into — Amazon Creator
            Connections, CJ, and friends. Creators see active ones in their
            dashboard widget; the platform tag earns the bonus commission
            during the campaign window.
          </p>
        </div>
        <Link
          href="/admin/campaigns/new"
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          + Add campaign
        </Link>
      </div>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        {campaigns.length === 0 ? (
          <EmptyState />
        ) : (
          <CampaignsList campaigns={campaigns} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-2xl">No campaigns yet.</p>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        After you opt into a campaign in Amazon Associates Central → Promotions
        → Creator Connections, add it here so creators can find the products in
        their dashboard.
      </p>
      <Link
        href="/admin/campaigns/new"
        className="inline-flex items-center gap-2 mt-6 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Add the first campaign
      </Link>
    </div>
  );
}
