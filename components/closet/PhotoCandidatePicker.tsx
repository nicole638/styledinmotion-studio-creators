"use client";

import { useMemo } from "react";
import { Check } from "lucide-react";

/**
 * Thumbnail grid for picking among up to 6 candidate product images the
 * scraper returned. Mirrors the ShopMy Snapshot picker pattern:
 *
 *   ┌──┐ ┌──┐ ┌──┐
 *   │✓│ │  │ │  │   ← selected one outlined in rose, check badge top-right
 *   └──┘ └──┘ └──┘
 *   ┌──┐ ┌──┐ ┌──┐
 *   │  │ │  │ │  │
 *   └──┘ └──┘ └──┘
 *
 * Renders nothing if there's 0 or 1 candidate (no choice to make). Tapping
 * a thumbnail calls onSelect with the picked URL. Parent owns state and
 * decides what `selectedUrl` is — usually it's whatever lives in
 * photo_url right now.
 *
 * Loading errors are silently dropped (the failed thumb just hides). Better
 * than showing a broken-image icon when a merchant URL goes 404.
 */
export function PhotoCandidatePicker({
  candidates,
  selectedUrl,
  onSelect,
  label = "Photo options from this URL",
}: {
  candidates: string[];
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  /** Section heading rendered above the grid. */
  label?: string;
}) {
  // Dedupe + cap defensively in case parent passes the same URL twice.
  // Backend already dedupes, but UI should be self-protecting.
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const u of candidates ?? []) {
      const trimmed = (u ?? "").trim();
      if (!trimmed) continue;
      if (seen.has(trimmed)) continue;
      seen.add(trimmed);
      out.push(trimmed);
      if (out.length >= 6) break;
    }
    return out;
  }, [candidates]);

  if (items.length <= 1) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <p className="text-xs uppercase tracking-widest text-muted mb-3">
        {label}
      </p>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {items.map((url) => {
          const isSelected = url === selectedUrl;
          return (
            <button
              key={url}
              type="button"
              onClick={() => onSelect(url)}
              className={
                "relative aspect-square rounded-xl overflow-hidden bg-bg transition-all " +
                (isSelected
                  ? "ring-2 ring-rose ring-offset-2 ring-offset-card"
                  : "ring-1 ring-border hover:ring-rose/60")
              }
              aria-pressed={isSelected}
              aria-label={isSelected ? "Selected photo" : "Use this photo"}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="w-full h-full object-cover"
                loading="lazy"
                onError={(e) => {
                  // Hide broken candidates so a 404 thumb doesn't camp in
                  // the grid. The image disappears but the button cell
                  // stays — picker grids should keep stable dimensions.
                  (e.currentTarget as HTMLImageElement).style.opacity = "0";
                }}
              />
              {isSelected ? (
                <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-rose grid place-items-center shadow-sm">
                  <Check size={12} strokeWidth={3} className="text-white" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Tap a different shot if the default isn't the one you want.
      </p>
    </div>
  );
}
