import { Suspense } from "react";
import { redirect } from "next/navigation";
import { fetchOwnProfile } from "@/lib/profile/queries";
import { fetchTikTokConnection } from "@/lib/tiktok/queries";
import { ProfileEditor } from "@/components/profile/ProfileEditor";
import { TikTokConnect } from "@/components/profile/TikTokConnect";

export const metadata = { title: "Profile" };

export default async function ProfilePage() {
  const profile = await fetchOwnProfile();
  if (!profile) redirect("/login");

  const tiktok = await fetchTikTokConnection();

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Profile
      </p>
      <h1 className="font-display text-4xl">
        {profile.firstName ? `${profile.firstName}'s profile.` : "Your profile."}
      </h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Same data your iOS profile uses. Updates here flow to the public
        feed and the body-type filters shoppers search with.
      </p>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <ProfileEditor initial={profile} />
      </div>

      <div className="mt-12 editorial-divider" />

      <Suspense fallback={null}>
        <TikTokConnect creatorId={profile.creatorId} initial={tiktok} />
      </Suspense>
    </div>
  );
}
