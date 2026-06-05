import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { isAdmin } from "@/lib/admin/auth";
import {
  getStorefrontById,
  listMembershipsForBrand,
  getStorefrontEarningsByStylist,
} from "@/lib/storefronts/queries";
import { StorefrontEditForm } from "./StorefrontEditForm";
import { LogoUploader } from "./LogoUploader";
import { MembershipsTable } from "./MembershipsTable";

export const metadata = { title: "Storefront · Admin" };
export const dynamic = "force-dynamic";

export default async function AdminStorefrontDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!(await isAdmin())) redirect("/");

  const storefront = await getStorefrontById(params.id);
  if (!storefront) notFound();

  const [memberships, earningsByStylist] = await Promise.all([
    listMembershipsForBrand(storefront.id),
    getStorefrontEarningsByStylist(storefront.storefrontCreatorId),
  ]);

  const ytdTotal = earningsByStylist.reduce((s, e) => s + e.totalUsd, 0);

  return (
    <div className="max-w-5xl">
      <Link
        href="/admin/storefronts"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink transition-colors mb-4"
      >
        <ChevronLeft size={14} /> Back to storefronts
      </Link>

      {/* Hero */}
      <div className="flex items-start gap-5">
        {storefront.logoUrl ? (
          <Image
            src={storefront.logoUrl}
            alt={storefront.name}
            width={72}
            height={72}
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-[72px] h-[72px] rounded-full bg-bg-alt border border-border flex items-center justify-center text-muted text-2xl">
            {storefront.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-2">
            Admin · Storefront
          </p>
          <h1 className="font-display text-4xl">{storefront.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="font-mono">/brand/{storefront.slug}</span>
            <span>·</span>
            <a
              href={`https://styledinmotion.studio/brand/${storefront.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-rose"
            >
              shopper page <ExternalLink size={11} />
            </a>
            {storefront.isTest ? (
              <>
                <span>·</span>
                <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wider bg-amber-100 text-amber-800 rounded-full">
                  test
                </span>
              </>
            ) : null}
          </div>
        </div>
        <Link
          href={`/admin/storefronts/${storefront.id}/danger`}
          className="text-sm text-muted hover:text-red-600"
        >
          Archive…
        </Link>
      </div>

      <div className="mt-10 editorial-divider" />

      {/* Two-col layout: edit form left, sidebar right */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-10">
          {/* Logo upload */}
          <section>
            <h2 className="font-display text-2xl mb-3">Brand mark</h2>
            <LogoUploader
              storefrontId={storefront.id}
              currentLogoUrl={storefront.logoUrl}
            />
          </section>

          {/* Editable fields */}
          <section>
            <h2 className="font-display text-2xl mb-3">Storefront details</h2>
            <StorefrontEditForm storefront={storefront} />
          </section>

          {/* Memberships */}
          <section>
            <h2 className="font-display text-2xl mb-3">Members</h2>
            <p className="text-sm text-muted mb-4 max-w-prose">
              Owners can view + approve. Stylists can publish looks under the
              brand. Analysts are view-only (investors, accountants, brand QA).
              All writes by stylists go to the storefront&apos;s creator_id, so
              Amazon commissions route to{" "}
              <span className="font-mono text-xs">{storefront.slug}</span>.
            </p>
            <MembershipsTable
              brandId={storefront.id}
              memberships={memberships}
            />
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:col-span-1 space-y-6">
          <SidebarCard title="Commission">
            <p className="text-3xl font-display">{storefront.commissionPct}%</p>
            <p className="text-xs text-muted mt-1">
              Applied to every click attributed to this storefront.
            </p>
          </SidebarCard>

          <SidebarCard title="Promo code">
            <p className="text-lg font-mono">
              {storefront.promoCode ?? <span className="text-muted">—</span>}
            </p>
          </SidebarCard>

          <SidebarCard title="Earnings · YTD">
            <p className="text-3xl font-display">${ytdTotal.toFixed(2)}</p>
            {earningsByStylist.length === 0 ? (
              <p className="text-xs text-muted mt-2">
                No commissions yet this year.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {earningsByStylist.map((row) => (
                  <li key={row.authoredBy ?? "unattributed"} className="flex justify-between">
                    <span className="text-muted">{row.stylistName}</span>
                    <span className="tabular-nums">${row.totalUsd.toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SidebarCard>

          <SidebarCard title="Account ids">
            <dl className="text-xs space-y-1.5 font-mono">
              <div>
                <dt className="text-muted">storefront.id</dt>
                <dd className="break-all">{storefront.id}</dd>
              </div>
              <div>
                <dt className="text-muted">creator_id</dt>
                <dd className="break-all">{storefront.storefrontCreatorId}</dd>
              </div>
            </dl>
          </SidebarCard>
        </aside>
      </div>
    </div>
  );
}

function SidebarCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <p className="text-xs uppercase tracking-[0.2em] text-muted mb-3">
        {title}
      </p>
      {children}
    </div>
  );
}
