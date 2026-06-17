"use client";

import { useEffect, useRef, useState } from "react";
import {
  Share2,
  Copy,
  Check,
  Instagram,
  Music2,
  Twitter,
  Mail,
  Bookmark,
  Download,
} from "lucide-react";

interface Props {
  /** looks.short_code — used to construct https://styled.in/<shortCode> */
  shortCode: string;
  /** looks.id — used to build the canonical public web look URL for Pinterest
   *  (https://shop.styledinmotion.studio/look/<lookId>). Pinterest pins must
   *  link to the web page (which renders in any browser); the app short link
   *  hands off to the iOS app and dead-ends when the app isn't installed. */
  lookId: string;
  /** Display title — shown in shared text + used as filename for IG/TikTok cover download */
  title: string;
  /** Cover photo URL (flattened PNG for collages, photo for regular looks). Required
   *  for IG/TikTok (image-download flow) and Pinterest (image attached to pin).
   *  If null, those channels fall back to copy-link with a "no cover" toast. */
  coverPhotoUrl: string | null;
}

type Status =
  | { kind: "idle" }
  | { kind: "copied" }
  | { kind: "ig-prepared" }
  | { kind: "tt-prepared" }
  | { kind: "error"; msg: string };

/**
 * Channel-aware share menu for published looks + collages.
 *
 * What each channel actually does:
 *   - Copy link        — clipboard write + 1.5s checkmark
 *   - Instagram        — fetch cover, trigger a browser download, copy link to
 *                        clipboard, show "Image saved + link copied. Open IG and
 *                        attach with a link sticker." (IG has no web share intent)
 *   - TikTok           — same flow as Instagram (no web share intent either)
 *   - Pinterest        — pinterest.com/pin/create/button intent URL — opens a
 *                        compose window with cover + description prefilled
 *   - X (Twitter)      — x.com/intent/post intent URL — text + URL prefilled
 *   - Email            — mailto: with subject + body
 *
 * Closes on outside click or Escape. Status toast slides into the trigger button
 * for ~2s after each action so the creator gets feedback without a modal.
 */
export function ShareLookMenu({ shortCode, lookId, title, coverPhotoUrl }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const menuRef = useRef<HTMLDivElement>(null);

  const lookUrl = `https://styled.in/${shortCode}`;
  // Pinterest must link to the public web page so the pin opens in a browser.
  // The styled.in short link hands off to the iOS app and won't launch from a
  // pin when the app isn't installed, so Pinterest gets the direct web URL.
  const pinterestUrl = `https://shop.styledinmotion.studio/look/${lookId}`;
  const shareTitle = title || "Styled in Motion — Shop the look";
  const shareText = `Shop the look: ${shareTitle}`;

  // Close on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Reset status when menu closes
  useEffect(() => {
    if (!open) return;
    setStatus({ kind: "idle" });
  }, [open]);

  // Auto-clear ephemeral statuses after 2s
  useEffect(() => {
    if (status.kind === "idle") return;
    const id = window.setTimeout(() => setStatus({ kind: "idle" }), 2500);
    return () => window.clearTimeout(id);
  }, [status]);

  // ─────────── Channel actions ───────────

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(lookUrl);
      setStatus({ kind: "copied" });
    } catch (e) {
      setStatus({
        kind: "error",
        msg: "Couldn't copy. Select and copy from the URL bar instead.",
      });
    }
  };

  // Download the cover image so the creator can attach it to an IG/TikTok story.
  // We also auto-copy the look URL so the link is one paste away.
  const downloadCover = async (
    filenameStem: string,
  ): Promise<{ ok: boolean; reason?: string }> => {
    if (!coverPhotoUrl)
      return { ok: false, reason: "no_cover" };
    try {
      const res = await fetch(coverPhotoUrl);
      if (!res.ok) return { ok: false, reason: `http_${res.status}` };
      const blob = await res.blob();
      // Best-guess extension from MIME, default to .jpg.
      const ext =
        blob.type === "image/png"
          ? "png"
          : blob.type === "image/webp"
            ? "webp"
            : "jpg";
      const safeStem = filenameStem
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 60) || "look";
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${safeStem}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Revoke after a tick so the browser has time to grab the blob.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      return { ok: true };
    } catch (e) {
      return { ok: false, reason: (e as Error).message ?? "fetch_failed" };
    }
  };

  const shareInstagram = async () => {
    const dl = await downloadCover(shareTitle);
    try {
      await navigator.clipboard.writeText(lookUrl);
    } catch {
      /* clipboard may fail on http or unfocused page — ignore */
    }
    if (!dl.ok) {
      setStatus({
        kind: "error",
        msg:
          dl.reason === "no_cover"
            ? "No cover image on this look — copy the link manually."
            : "Couldn't download cover. Link is copied — save the image from the look page instead.",
      });
      return;
    }
    setStatus({ kind: "ig-prepared" });
  };

  const shareTiktok = async () => {
    const dl = await downloadCover(shareTitle);
    try {
      await navigator.clipboard.writeText(lookUrl);
    } catch {
      /* ignore */
    }
    if (!dl.ok) {
      setStatus({
        kind: "error",
        msg:
          dl.reason === "no_cover"
            ? "No cover image on this look — copy the link manually."
            : "Couldn't download cover. Link is copied.",
      });
      return;
    }
    setStatus({ kind: "tt-prepared" });
  };

  const sharePinterest = () => {
    const intent = new URL("https://www.pinterest.com/pin/create/button/");
    intent.searchParams.set("url", pinterestUrl);
    if (coverPhotoUrl) intent.searchParams.set("media", coverPhotoUrl);
    intent.searchParams.set("description", shareText);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const shareX = () => {
    const intent = new URL("https://x.com/intent/post");
    intent.searchParams.set("text", shareText);
    intent.searchParams.set("url", lookUrl);
    window.open(intent.toString(), "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const shareEmail = () => {
    const subject = encodeURIComponent(shareTitle);
    const body = encodeURIComponent(`${shareText}\n\n${lookUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  return (
    <div ref={menuRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card text-text px-4 py-2 text-sm font-medium hover:border-rose transition-colors"
      >
        <Share2 size={14} strokeWidth={2} />
        Share
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 rounded-2xl border border-border bg-bg shadow-lg z-20 overflow-hidden"
        >
          <MenuRow
            label="Copy link"
            sub={lookUrl.replace(/^https?:\/\//, "")}
            icon={status.kind === "copied" ? Check : Copy}
            onClick={copyLink}
          />
          <MenuRow
            label="Instagram"
            sub="Saves cover + copies link"
            icon={Instagram}
            onClick={shareInstagram}
          />
          <MenuRow
            label="TikTok"
            sub="Saves cover + copies link"
            icon={Music2}
            onClick={shareTiktok}
          />
          <MenuRow
            label="Pinterest"
            sub="Opens Pinterest with this look"
            icon={Bookmark}
            onClick={sharePinterest}
          />
          <MenuRow
            label="X"
            sub="Compose a post"
            icon={Twitter}
            onClick={shareX}
          />
          <MenuRow
            label="Email"
            sub="Send the link by email"
            icon={Mail}
            onClick={shareEmail}
          />

          {status.kind === "ig-prepared" || status.kind === "tt-prepared" ? (
            <ToastInsideMenu
              icon={Download}
              title={
                status.kind === "ig-prepared"
                  ? "Cover saved + link copied"
                  : "Cover saved + link copied"
              }
              body={
                status.kind === "ig-prepared"
                  ? "Open Instagram → New Story → upload the image → add a link sticker with the copied URL."
                  : "Open TikTok → New post → upload the image → paste the link in your caption or bio."
              }
            />
          ) : null}

          {status.kind === "copied" ? (
            <ToastInsideMenu
              icon={Check}
              title="Link copied"
              body="Paste it anywhere — DM, caption, link-in-bio."
            />
          ) : null}

          {status.kind === "error" ? (
            <ToastInsideMenu icon={Copy} title="Something went wrong" body={status.msg} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function MenuRow({
  label,
  sub,
  icon: Icon,
  onClick,
}: {
  label: string;
  sub: string;
  icon: typeof Copy;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-card transition-colors"
    >
      <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-card border border-border">
        <Icon size={14} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted truncate">{sub}</span>
      </span>
    </button>
  );
}

function ToastInsideMenu({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof Copy;
  title: string;
  body: string;
}) {
  return (
    <div className="border-t border-border bg-card px-4 py-3 flex items-start gap-3">
      <span className="shrink-0 mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full bg-bg border border-border">
        <Icon size={12} strokeWidth={2} />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted leading-snug">{body}</p>
      </div>
    </div>
  );
}
