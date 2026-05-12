"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface Props {
  /** looks.short_code — the public-URL slug used at styled.in/<shortCode> */
  shortCode: string;
  /** Display title used in the share-sheet payload and clipboard toast */
  title: string;
  /**
   * "primary"  — pill button next to Edit on look detail
   * "overlay"  — small circular icon over a look thumbnail (LookCard)
   * "ghost"    — minimal bordered version for secondary surfaces
   */
  variant?: "primary" | "overlay" | "ghost";
  /** Optional click handler to fire after the share attempt completes — useful
   *  for stopping propagation when this sits inside a parent <Link>. */
  onAfterClick?: () => void;
}

/**
 * Web share affordance for published looks (and collages — same entity, same
 * short_code). Strategy:
 *   1. If navigator.share is present (mobile Safari, mobile Chrome, macOS
 *      Sequoia Safari, etc.), use the native share sheet — picks up IG / TikTok
 *      / Messages / Mail / AirDrop without us having to wire each one.
 *   2. Otherwise fall back to copying the URL to the clipboard and flashing a
 *      checkmark for 1.5s. The vast majority of desktop creators end up here.
 *
 * Share URL pattern is `https://styled.in/<shortCode>` — matches the existing
 * "Public link" callout on the look detail page. Backed by the existing short-
 * code redirect, no new infra.
 */
export function ShareLookButton({
  shortCode,
  title,
  variant = "primary",
  onAfterClick,
}: Props) {
  const [copied, setCopied] = useState(false);

  const url = `https://styled.in/${shortCode}`;
  const shareTitle = title || "Styled in Motion — Shop the look";
  const shareText = `Shop the look: ${shareTitle}`;

  const handleClick = async (e: React.MouseEvent) => {
    // Stop the click from bubbling to a parent <Link> (LookCard wraps the whole
    // card in one). Without this, clicking the share icon also opens the look.
    e.preventDefault();
    e.stopPropagation();

    try {
      // Use typeof checks rather than `"share" in navigator` — Navigator's
      // lib.dom.d.ts type declares `share?:` as optional, which causes the
      // `in` operator to narrow the else branch's navigator to `never` under
      // strict TS. typeof on the property is a runtime check that doesn't
      // confuse the type-checker.
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title: shareTitle, text: shareText, url });
      } else if (
        typeof navigator !== "undefined" &&
        typeof navigator.clipboard?.writeText === "function"
      ) {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      } else {
        // Last-ditch fallback — execCommand-based copy. Almost never hit in 2026
        // but cheap to keep.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // User cancelled the share sheet or the API rejected — soft fail.
    } finally {
      onAfterClick?.();
    }
  };

  if (variant === "overlay") {
    return (
      <button
        type="button"
        onClick={handleClick}
        aria-label={copied ? "Link copied" : "Share look"}
        title={copied ? "Link copied" : "Share"}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-bg/90 backdrop-blur text-text border border-border hover:border-rose hover:text-rose transition-colors shadow-sm"
      >
        {copied ? (
          <Check size={14} strokeWidth={2} />
        ) : (
          <Share2 size={14} strokeWidth={2} />
        )}
      </button>
    );
  }

  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-rose transition-colors"
      >
        {copied ? (
          <>
            <Check size={14} strokeWidth={2} />
            Link copied
          </>
        ) : (
          <>
            <Share2 size={14} strokeWidth={2} />
            Share
          </>
        )}
      </button>
    );
  }

  // primary
  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-card text-text px-4 py-2 text-sm font-medium hover:border-rose transition-colors"
    >
      {copied ? (
        <>
          <Check size={14} strokeWidth={2} />
          Link copied
        </>
      ) : (
        <>
          <Share2 size={14} strokeWidth={2} />
          Share
        </>
      )}
    </button>
  );
}
