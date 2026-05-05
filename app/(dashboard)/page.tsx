import { createClient } from "@/lib/supabase/server";
import { Sparkles, Camera, Layers, FileEdit } from "lucide-react";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const firstName =
    (user?.user_metadata?.first_name as string | undefined) ?? "there";

  return (
    <div className="max-w-4xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Welcome
      </p>
      <h1 className="font-display text-4xl">Hi, {firstName}.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        This is your Studio. From here you'll manage your closet,
        compose looks from desktop, save drafts, and edit your profile.
        Phase 1A is the foundation — feature panels open up over the
        next few weeks.
      </p>

      <div className="mt-12 editorial-divider" />

      <p className="mt-10 text-xs uppercase tracking-[0.25em] text-rose mb-4">
        Coming up
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <Tile
          icon={<Camera size={18} strokeWidth={1.75} />}
          title="Looks"
          copy="Upload your cover photo from desktop, multi-select pieces from your closet, write a caption, and publish — or save a draft and finish later."
        />
        <Tile
          icon={<Layers size={18} strokeWidth={1.75} />}
          title="Collage"
          copy="Compose Style Journal, Editorial, Grid, and Editorial Cover collages on a wider canvas. Drag pieces with a mouse, no thumb gymnastics."
        />
        <Tile
          icon={<FileEdit size={18} strokeWidth={1.75} />}
          title="Drafts"
          copy="Pick up exactly where you left off. Drafts you save here sync with the iOS app and vice versa."
        />
        <Tile
          icon={<Sparkles size={18} strokeWidth={1.75} />}
          title="Closet"
          copy="Paste a URL or a list of URLs and we'll pull the photo, brand, and price for each. Edit pieces, replace photos, set your usual size."
        />
      </div>
    </div>
  );
}

function Tile({
  icon,
  title,
  copy,
}: {
  icon: React.ReactNode;
  title: string;
  copy: string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-2 text-rose">
        {icon}
        <h3 className="font-display text-lg leading-none">{title}</h3>
      </div>
      <p className="text-sm text-muted leading-relaxed">{copy}</p>
    </div>
  );
}
