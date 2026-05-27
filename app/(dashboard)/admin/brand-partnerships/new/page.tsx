import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import NewPartnershipForm from "./NewPartnershipForm";

export const metadata = { title: "New campaign · Brand partnerships" };
export const dynamic = "force-dynamic";

export default async function NewBrandPartnershipPage() {
  if (!(await isAdmin())) redirect("/");

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/admin/brand-partnerships"
          className="text-sm text-muted hover:text-text underline underline-offset-4"
        >
          ← All campaigns
        </Link>
      </div>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · New brand campaign
      </p>
      <h1 className="font-display text-4xl">Create a campaign.</h1>
      <p className="mt-3 text-muted leading-relaxed">
        Define a sponsored campaign you&apos;re running with a brand.
        Status starts as <em>draft</em> — flip to <em>open</em> when
        you&apos;re ready to offer it to priority creators.
      </p>

      <div className="mt-10 editorial-divider mb-10" />

      <NewPartnershipForm />
    </div>
  );
}
