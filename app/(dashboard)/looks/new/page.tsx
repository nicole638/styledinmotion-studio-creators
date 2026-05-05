import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchClosetItems } from "@/lib/closet/queries";
import { LookComposer } from "@/components/looks/LookComposer";

export const metadata = { title: "Create look" };

export default async function NewLookPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const closet = await fetchClosetItems({ archivedOnly: false });

  return (
    <div className="max-w-3xl">
      <Link
        href="/looks"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Looks
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Create look
      </p>
      <h1 className="font-display text-4xl">A new look.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Drop a cover photo, give it a title and caption, then tag the pieces
        you're wearing. Save as a draft to keep building, or publish to push
        it live to shoppers.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <LookComposer
          mode="create"
          creatorId={user.id}
          closet={closet}
        />
      </div>
    </div>
  );
}
