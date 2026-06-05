import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import { getStorefrontById } from "@/lib/storefronts/queries";
import { ArchiveConfirm } from "./ArchiveConfirm";

export const metadata = { title: "Archive storefront · Admin" };
export const dynamic = "force-dynamic";

export default async function ArchiveStorefrontPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await isAdmin())) redirect("/");

  const storefront = await getStorefrontById(params.id);
  if (!storefront) notFound();

  return (
    <div className="max-w-2xl">
      <Link
        href={`/admin/storefronts/${storefront.id}`}
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-4"
      >
        <ChevronLeft size={14} /> Back to storefront
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-red-600 mb-3">
        Admin · Archive storefront
      </p>
      <h1 className="font-display text-4xl">Archive {storefront.name}?</h1>
      <p className="mt-3 text-muted leading-relaxed">
        Sets status to <span className="font-medium">archived</span>. The
        storefront&apos;s looks disappear from the public discover feed and the
        shopper-facing <span className="font-mono">/brand/{storefront.slug}</span>{" "}
        page. Memberships stay intact (revoke individually if needed) and
        commission history is preserved.
      </p>
      <p className="mt-3 text-muted leading-relaxed">
        This is reversible — flip the status back to <em>active</em> from the
        detail page to restore.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <ArchiveConfirm storefrontId={storefront.id} storefrontName={storefront.name} />
      </div>
    </div>
  );
}
