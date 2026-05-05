"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, User as UserIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";

export function Header({
  firstName,
  email,
}: {
  firstName: string | null;
  email: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initial =
    (firstName?.[0] || email[0] || "?").toUpperCase();

  return (
    <header className="border-b border-border bg-bg">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="md:hidden">
          <Link href="/" className="font-display text-lg leading-none">
            Studio
          </Link>
        </div>
        <div className="flex-1" />
        <div className="relative">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-border bg-card pl-1.5 pr-3 py-1.5 hover:border-rose transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-rose text-white text-xs font-semibold flex items-center justify-center">
              {initial}
            </span>
            <span className="text-sm hidden sm:inline">
              {firstName ?? email}
            </span>
            <ChevronDown size={14} strokeWidth={2} />
          </button>
          <div
            className={cn(
              "absolute right-0 top-full mt-2 min-w-[180px] rounded-2xl border border-border bg-card shadow-sm py-2 transition-opacity",
              open ? "opacity-100" : "opacity-0 pointer-events-none",
            )}
          >
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-bg"
            >
              <UserIcon size={14} strokeWidth={1.75} />
              Profile
            </Link>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-bg"
            >
              <LogOut size={14} strokeWidth={1.75} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
