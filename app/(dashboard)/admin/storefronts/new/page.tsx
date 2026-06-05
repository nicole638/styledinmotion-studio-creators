import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { NewStorefrontForm } from "./NewStorefrontForm";

export const metadata = { title: "New storefront · Admin" };
export const dynamic = "force-dynamic";

export default async function NewStorefrontPage() {
  if (!(await isAdmin())) redirect("/");

  return (
    <div className="max-w-3xl">
      <Link
        href="/admin/storefronts"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-4"
      >
        <ChevronLeft size={14} /> Back to storefronts
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · New storefront
      </p>
      <h1 className="font-display text-4xl">Create a partner brand.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Creates the storefront content account (synthetic auth user + creators
        row + creator_profiles row tagged{" "}
        <span className="font-medium">partner_brand</span>) along with the
        business record. You can upload the logo and assign members after the
        storefront exists.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <NewStorefrontForm />
      </div>
    </div>
  );
}
