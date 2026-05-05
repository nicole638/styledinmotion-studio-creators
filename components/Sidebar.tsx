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
} from "lucide-react";
import { cn } from "@/lib/cn";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, status: "live" as const },
  { href: "/closet", label: "Closet", icon: Shirt, status: "live" as const },
  { href: "/looks", label: "Looks", icon: Camera, status: "live" as const },
  { href: "/collage", label: "Collage", icon: Layers, status: "soon" as const },
  { href: "/drafts", label: "Drafts", icon: FileEdit, status: "live" as const },
  { href: "/profile", label: "Profile", icon: User, status: "live" as const },
];

export function Sidebar() {
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
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                active
                  ? "bg-rose text-white"
                  : "text-text hover:bg-card",
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
        })}
      </nav>
      <div className="px-6 py-4 border-t border-border text-xs text-muted">
        Beta · {new Date().getFullYear()}
      </div>
    </aside>
  );
}
