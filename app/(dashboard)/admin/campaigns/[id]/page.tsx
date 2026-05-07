import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { getCampaignById } from "@/lib/campaigns/queries";
import { CampaignForm } from "../new/CampaignForm";

export const metadata = { title: "Edit campaign · Admin" };
export const dynamic = "force-dynamic";

export default async function EditCampaignPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await isAdmin())) redirect("/");

  const campaign = await getCampaignById(params.id);
  if (!campaign) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/campaigns"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} />
        All campaigns
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Edit campaign
      </p>
      <h1 className="font-display text-4xl">{campaign.brandName}.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Update campaign window, ASINs, or budget remaining. Archived campaigns
        won't appear in the creator dashboard widget.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <CampaignForm mode="edit" initial={campaign} />
      </div>
    </div>
  );
}
