import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { AwinMerchantForm } from "./AwinMerchantForm";

export const metadata = { title: "New Awin merchant · Admin" };

export default async function NewAwinMerchantPage() {
  if (!(await isAdmin())) redirect("/");

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
        Admin · Add merchant
      </p>
      <h1 className="font-display text-4xl">New Awin merchant.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        After Awin approves the program, copy the merchant&apos;s ID and
        primary domain here. Set status to <em>active</em> once the
        approval email lands — /api/shop will then start wrapping
        creator clicks on that merchant&apos;s URLs.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <AwinMerchantForm mode="create" />
      </div>
    </div>
  );
}
