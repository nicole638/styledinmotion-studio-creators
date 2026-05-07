import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { CampaignForm } from "./CampaignForm";

export const metadata = { title: "New campaign · Admin" };

export default async function NewCampaignPage() {
  if (!(await isAdmin())) redirect("/");

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
        Admin · Add campaign
      </p>
      <h1 className="font-display text-4xl">New brand campaign.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Once you've opted into a campaign in Amazon Associates Central →
        Promotions → Creator Connections, copy the details here so creators
        can feature the products in their looks.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <CampaignForm mode="create" />
      </div>
    </div>
  );
}
