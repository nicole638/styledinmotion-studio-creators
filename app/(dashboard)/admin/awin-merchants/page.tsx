import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { listAwinMerchantsForAdmin } from "@/lib/awin/queries";
import { AwinMerchantsList } from "./AwinMerchantsList";

export const metadata = { title: "Awin merchants · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminAwinMerchantsPage() {
  if (!(await isAdmin())) redirect("/");

  const merchants = await listAwinMerchantsForAdmin();

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Awin merchants
      </p>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Awin partner directory.</h1>
          <p className="mt-3 text-muted leading-relaxed max-w-prose">
            Merchants we&apos;ve been approved for through Awin. When a
            merchant is set to <em>active</em>, /api/shop wraps creator
            clicks on that merchant&apos;s URLs into Awin tracked links
            with the creator&apos;s clickref. Add a merchant here after
            you approve the program in your Awin dashboard.
          </p>
        </div>
        <Link
          href="/admin/awin-merchants/new"
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          + Add merchant
        </Link>
      </div>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        {merchants.length === 0 ? (
          <EmptyState />
        ) : (
          <AwinMerchantsList merchants={merchants} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
      <p className="font-display text-2xl">No Awin merchants yet.</p>
      <p className="mt-2 text-sm text-muted leading-relaxed max-w-md mx-auto">
        Once Awin approves a program, copy the merchant ID (
        <code className="text-text">awinmid</code>) and primary domain
        here. Active merchants will be auto-recognized in the creator
        closet add flow and on /api/shop redirects.
      </p>
      <Link
        href="/admin/awin-merchants/new"
        className="inline-flex items-center gap-2 mt-6 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        + Add the first merchant
      </Link>
    </div>
  );
}
