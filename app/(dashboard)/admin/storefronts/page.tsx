import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { listStorefrontsForAdmin } from "@/lib/storefronts/queries";
import { StorefrontsList } from "./StorefrontsList";

export const metadata = { title: "Storefronts · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminStorefrontsPage() {
  if (!(await isAdmin())) redirect("/");

  const storefronts = await listStorefrontsForAdmin();

  return (
    <div className="max-w-5xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Storefronts
      </p>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-4xl">Partner brand storefronts.</h1>
          <p className="mt-3 text-muted leading-relaxed max-w-prose">
            Persistent partner-brand accounts (Golden Bear Garage is the first).
            Each storefront owns its own looks + items; humans access it via
            <span className="font-medium"> brand memberships </span>
            with an owner / stylist / analyst role. SiM earns the storefront&apos;s
            <span className="font-medium"> commission % </span>
            on every click that originates from a look published as the brand.
          </p>
        </div>
        <Link
          href="/admin/storefronts/new"
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity shrink-0"
        >
          + New storefront
        </Link>
      </div>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        {storefronts.length === 0 ? (
          <EmptyState />
        ) : (
          <StorefrontsList storefronts={storefronts} />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 border border-dashed border-border rounded-2xl">
      <p className="text-muted">No storefronts yet.</p>
      <Link
        href="/admin/storefronts/new"
        className="inline-block mt-4 text-rose font-medium hover:opacity-80"
      >
        Create the first one →
      </Link>
    </div>
  );
}
