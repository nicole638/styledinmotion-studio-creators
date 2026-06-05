"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Shirt,
  Camera,
  Layers,
  FileEdit,
  User,
  DollarSign,
  Megaphone,
  FileSpreadsheet,
  Store,
  Sparkles,
  MousePointerClick,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/cn";

type NavStatus = "live" | "soon";
interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  status: NavStatus;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, status: "live" },
  { href: "/closet", label: "Closet", icon: Shirt, status: "live" },
  { href: "/brands", label: "Brands", icon: Store, status: "live" },
  { href: "/looks", label: "Looks", icon: Camera, status: "live" },
  { href: "/collage", label: "Collage", icon: Layers, status: "live" },
  { href: "/drafts", label: "Drafts", icon: FileEdit, status: "live" },
  { href: "/earnings", label: "Earnings", icon: DollarSign, status: "live" },
  { href: "/profile", label: "Profile", icon: User, status: "live" },
];

const ADMIN_NAV_ITEMS: NavItem[] = [
  {
    href: "/admin/storefronts",
    label: "Storefronts",
    icon: Building2,
    status: "live",
  },
  {
    href: "/admin/campaigns",
    label: "Campaigns",
    icon: Megaphone,
    status: "live",
  },
  {
    href: "/admin/awin-merchants",
    label: "Awin merchants",
    icon: Store,
    status: "live",
  },
  {
    href: "/admin/ingest-amazon",
    label: "Ingest Amazon",
    icon: FileSpreadsheet,
    status: "live",
  },
  {
    href: "/admin/brand-partnerships",
    label: "Brand partnerships",
    icon: Sparkles,
    status: "live",
  },
  {
    href: "/admin/click-analytics",
    label: "Click analytics",
    icon: MousePointerClick,
    status: "live",
  },
];

export function Sidebar({ showAdminNav = false }: { showAdminNav?: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex md:flex-col w-64 shrink-0 border-r border-border bg-bg">
      <div className="px-6 py-6 border-b border-border">
        <Link href="/" className="block">
          <p className="font-display text-xl leading-none">Styled in Motion</p>
          <p className="text-xs uppercase tracking-[0.2em] text-rose mt-1">
            Creator Studio
          </p>
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        {showAdminNav ? (
          <>
            <div className="pt-6 pb-1 px-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted">
                Admin
              </p>
            </div>
            {ADMIN_NAV_ITEMS.map((item) => (
              <NavLink key={item.href} item={item} pathname={pathname} />
            ))}
          </>
        ) : null}
      </nav>
      <div className="px-6 py-4 border-t border-border text-xs text-muted">
        Beta · {new Date().getFullYear()}
      </div>
    </aside>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  // Admin sub-pages (e.g. /admin/campaigns/new) should still highlight the
  // top-level "Campaigns" link — match by prefix for /admin/* entries.
  const active = item.href.startsWith("/admin/")
    ? pathname.startsWith(item.href)
    : pathname === item.href;
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
        active ? "bg-rose text-white" : "text-text hover:bg-card",
      )}
    >
      <Icon size={18} strokeWidth={1.75} />
      <span className="flex-1">{item.label}</span>
      {item.status === "soon" ? (
        <span className="text-[10px] uppercase tracking-widest text-muted">
          Soon
        </span>
      ) : null}
    </Link>
  );
}
