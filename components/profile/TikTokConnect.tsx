"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Music2, CheckCircle2, BadgeCheck } from "lucide-react";
import { disconnectTikTokAction } from "@/lib/tiktok/mutations";
import type { TikTokConnection } from "@/lib/tiktok/queries";

interface Props {
  creatorId: string;
  initial: TikTokConnection;
}

const fmt = (n: number | null) =>
  n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `${n}`;

export function TikTokConnect({ creatorId, initial }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);

  // Surface the ?tiktok=connected|error result the OAuth redirect appends,
  // then refresh so the connected card reflects the fresh stats.
  useEffect(() => {
    const status = params.get("tiktok");
    if (!status) return;
    if (status === "connected") {
      setFlash("TikTok connected.");
      router.refresh();
    } else if (status === "error") {
      setFlash("Couldn't connect TikTok. Please try again.");
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("tiktok");
    url.searchParams.delete("reason");
    window.history.replaceState({}, "", url.toString());
  }, [params, router]);

  function connect() {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const redirectBack = `${window.location.origin}/profile`;
    const url =
      `${base}/functions/v1/tiktok-oauth?action=start` +
      `&creator_id=${encodeURIComponent(creatorId)}` +
      `&redirect_back=${encodeURIComponent(redirectBack)}`;
    window.location.assign(url);
  }

  function disconnect() {
    startTransition(async () => {
      await disconnectTikTokAction();
      setFlash("TikTok disconnected.");
      router.refresh();
    });
  }

  return (
    <section className="mt-10">
      <div className="flex items-center gap-2">
        <Music2 className="h-4 w-4 text-rose" />
        <h2 className="font-display text-2xl">TikTok</h2>
      </div>
      <p className="mt-2 text-sm text-muted max-w-prose">
        Connect your TikTok so Styled in Motion can show your reach and post
        your looks straight to your TikTok drafts.
      </p>

      {flash && (
        <p className="mt-3 text-sm text-rose">{flash}</p>
      )}

      {initial.connected ? (
        <div className="mt-5 rounded-2xl border border-black/10 p-5">
          <div className="flex items-center gap-3">
            {initial.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={initial.avatarUrl}
                alt=""
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <div className="h-12 w-12 rounded-full bg-black/5" />
            )}
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-medium">
                  {initial.displayName ?? "Connected"}
                </span>
                {initial.isVerified && (
                  <BadgeCheck className="h-4 w-4 text-rose" />
                )}
              </div>
              <div className="flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected
              </div>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Followers
              </dt>
              <dd className="mt-1 font-display text-xl">
                {fmt(initial.followerCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Likes
              </dt>
              <dd className="mt-1 font-display text-xl">
                {fmt(initial.likesCount)}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted">
                Videos
              </dt>
              <dd className="mt-1 font-display text-xl">
                {fmt(initial.videoCount)}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={disconnect}
            disabled={isPending}
            className="mt-5 text-sm text-muted underline underline-offset-4 hover:text-rose disabled:opacity-50"
          >
            {isPending ? "Disconnecting…" : "Disconnect TikTok"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={connect}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-black px-6 py-3 text-sm font-medium text-white transition hover:opacity-90"
        >
          <Music2 className="h-4 w-4" />
          Connect TikTok
        </button>
      )}
    </section>
  );
}
