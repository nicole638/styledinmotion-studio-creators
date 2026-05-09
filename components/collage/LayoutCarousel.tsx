"use client";

import { useMemo } from "react";
import { Shuffle } from "lucide-react";
import {
  type LayoutTemplate,
  getLayoutsForItemCount,
} from "@/lib/collage/layouts";

interface Props {
  /** Number of cutout layers currently on the canvas. Drives the layout list. */
  itemCount: number;
  /** Currently-applied layout id (highlights its card). */
  selectedLayoutId: string | null;
  /** Called when a creator taps a layout thumbnail. */
  onSelect: (layout: LayoutTemplate) => void;
  /** Seed for the algorithmic generator. Bumping it reshuffles "Mix" variants. */
  seed: number;
  /** Reshuffle the algorithmic variants in place. */
  onReshuffle: () => void;
}

/**
 * Horizontal carousel of layout options. Mirrors the iOS Layout app:
 * thumbnails preview each layout's cell arrangement; tap to apply.
 *
 * Hidden when itemCount < 1 (nothing to lay out yet) or > 6 (we don't have
 * curated/algorithmic templates beyond 6 cells).
 */
export function LayoutCarousel({
  itemCount,
  selectedLayoutId,
  onSelect,
  seed,
  onReshuffle,
}: Props) {
  const layouts = useMemo(
    () => getLayoutsForItemCount(itemCount, seed),
    [itemCount, seed],
  );

  if (layouts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-muted">
          Layout
        </div>
        <button
          type="button"
          onClick={onReshuffle}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
          aria-label="Reshuffle algorithmic layouts"
          title="Reshuffle the variants on the right"
        >
          <Shuffle size={12} strokeWidth={2} />
          Shuffle
        </button>
      </div>

      {/* Horizontal scroll list. -mx-4 + px-4 lets cards bleed off the
          editor's gutter so it feels like a real carousel. */}
      <div className="-mx-4 px-4 overflow-x-auto pb-2 scrollbar-thin">
        <ul className="flex gap-2 w-max">
          {layouts.map((layout) => (
            <li key={layout.id}>
              <button
                type="button"
                onClick={() => onSelect(layout)}
                className={`group block rounded-xl border bg-card p-2 transition-colors ${
                  selectedLayoutId === layout.id
                    ? "border-rose ring-2 ring-rose/20"
                    : "border-border hover:border-rose"
                }`}
                aria-label={`Apply ${layout.name} layout`}
              >
                <LayoutThumbnail layout={layout} />
                <div className="mt-1.5 text-[11px] text-muted text-center max-w-[80px] truncate">
                  {layout.name}
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/**
 * Tiny SVG preview of a layout's cell partition. Each cell is a filled rect
 * with the brand rose tint, rotation included. 80×80px so a full carousel
 * row of 10 fits comfortably without horizontal-scroll fatigue.
 */
function LayoutThumbnail({ layout }: { layout: LayoutTemplate }) {
  const SIZE = 80;
  const STROKE = 1;
  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="block"
      aria-hidden
    >
      {/* Background panel */}
      <rect
        x={0}
        y={0}
        width={SIZE}
        height={SIZE}
        rx={4}
        fill="var(--color-bg, #FAFAF7)"
      />
      {layout.cells.map((cell, i) => {
        const x = cell.x * SIZE;
        const y = cell.y * SIZE;
        const w = cell.w * SIZE;
        const h = cell.h * SIZE;
        const rot = cell.rotation ?? 0;
        const cx = x + w / 2;
        const cy = y + h / 2;
        return (
          <rect
            key={i}
            x={x + STROKE / 2}
            y={y + STROKE / 2}
            width={Math.max(0, w - STROKE)}
            height={Math.max(0, h - STROKE)}
            rx={2}
            fill="var(--color-rose, #B53D2A)"
            fillOpacity={0.18 + (i / Math.max(layout.cells.length - 1, 1)) * 0.18}
            stroke="var(--color-rose, #B53D2A)"
            strokeOpacity={0.4}
            strokeWidth={STROKE}
            transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
          />
        );
      })}
    </svg>
  );
}
