import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { getAwinMerchantById } from "@/lib/awin/queries";
import { AwinMerchantForm } from "../new/AwinMerchantForm";

export const metadata = { title: "Edit Awin merchant · Admin" };
export const dynamic = "force-dynamic";

export default async function EditAwinMerchantPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await isAdmin())) redirect("/");

  const merchant = await getAwinMerchantById(params.id);
  if (!merchant) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href="/admin/awin-merchants"
        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} />
        All Awin merchants
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Edit merchant
      </p>
      <h1 className="font-display text-4xl">{merchant.merchantName}.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Update status, commission band, or domains. Setting status to
        <em> active</em> turns on URL recognition for this merchant on the
        next page load.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <AwinMerchantForm mode="edit" initial={merchant} />
      </div>
    </div>
  );
}
