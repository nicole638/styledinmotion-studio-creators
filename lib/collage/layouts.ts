/**
 * Phase 3 — Layout-discovery system.
 *
 * A LayoutTemplate is a rectangular partition of the 1080×1080 canvas into
 * `cells`. When a creator picks a layout, each item is placed at its cell's
 * center with a scale that fits the cell. The existing per-item drag/pinch/
 * rotate (Phase 2) still works on top — layouts are a starting point, not a
 * constraint.
 *
 * Two flavors:
 *   - 'curated'    — hand-designed; 5 per item-count for counts 1..6.
 *   - 'algorithmic' — generated via deterministic recursive bin-packing.
 *                     5 per item-count, seeded so layouts are stable per session.
 *
 * The carousel surfaces the 10 layouts (5 curated + 5 algorithmic) for the
 * current item count and lets the creator try them on instantly.
 *
 * Coordinate space:
 *   Cells use NORMALIZED coordinates (x, y, w, h ∈ [0, 1]). Renderers convert
 *   to 1080-space (CANVAS_SIZE) when applying. Keep cells in this space so
 *   they're trivially shareable with iOS without re-tuning.
 */

import {
  CANVAS_SIZE,
  type CutoutLayer,
} from "@/types/collage";

// ─────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────

export interface LayoutCell {
  /** Top-left x, normalized 0..1. */
  x: number;
  /** Top-left y, normalized 0..1. */
  y: number;
  /** Width, normalized 0..1. */
  w: number;
  /** Height, normalized 0..1. */
  h: number;
  /** Optional rotation in degrees (small angles only, e.g. -8..8). */
  rotation?: number;
}

export type LayoutItemCount = 1 | 2 | 3 | 4 | 5 | 6;

export interface LayoutTemplate {
  /** Stable id; used as key in carousel + saved with the look for analytics. */
  id: string;
  itemCount: LayoutItemCount;
  kind: "curated" | "algorithmic";
  /** Display name shown in the carousel previews and tooltips. */
  name: string;
  /** Cells in z-order: first cell is bottom layer, last is top. */
  cells: LayoutCell[];
}

// ─────────────────────────────────────────────────────────────────────
// Curated templates — 5 per item count = 30 total
// ─────────────────────────────────────────────────────────────────────
//
// Design notes:
// - Cells must fill or near-fill the canvas; gaps read as "empty" to creators.
// - Aspect ratios skew portrait when possible — most clothing photos are tall.
// - Rotations are small (≤ 5°) and only used in 1-2 layouts per count for spice.
// - Last cell wins on z-order, so put accent/foreground items last.

export const CURATED_LAYOUTS: LayoutTemplate[] = [
  // ─── 1 item ─────────────────────────────────────────────────────
  {
    id: "curated-1-full",
    itemCount: 1,
    kind: "curated",
    name: "Full bleed",
    cells: [{ x: 0, y: 0, w: 1, h: 1 }],
  },
  {
    id: "curated-1-portrait",
    itemCount: 1,
    kind: "curated",
    name: "Portrait",
    cells: [{ x: 0.18, y: 0.04, w: 0.64, h: 0.92 }],
  },
  {
    id: "curated-1-square-center",
    itemCount: 1,
    kind: "curated",
    name: "Square center",
    cells: [{ x: 0.15, y: 0.15, w: 0.7, h: 0.7 }],
  },
  {
    id: "curated-1-tilted",
    itemCount: 1,
    kind: "curated",
    name: "Tilted square",
    cells: [{ x: 0.16, y: 0.16, w: 0.68, h: 0.68, rotation: -4 }],
  },
  {
    id: "curated-1-tall-left",
    itemCount: 1,
    kind: "curated",
    name: "Tall left",
    cells: [{ x: 0.05, y: 0.05, w: 0.55, h: 0.9 }],
  },

  // ─── 2 items ────────────────────────────────────────────────────
  {
    id: "curated-2-split-horizontal",
    itemCount: 2,
    kind: "curated",
    name: "Split horizontal",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 1, h: 0.5 },
    ],
  },
  {
    id: "curated-2-split-vertical",
    itemCount: 2,
    kind: "curated",
    name: "Split vertical",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 },
      { x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: "curated-2-large-small",
    itemCount: 2,
    kind: "curated",
    name: "Hero + companion",
    cells: [
      { x: 0, y: 0, w: 0.65, h: 1 },
      { x: 0.65, y: 0.22, w: 0.35, h: 0.56 },
    ],
  },
  {
    id: "curated-2-stacked-narrow",
    itemCount: 2,
    kind: "curated",
    name: "Stacked centered",
    cells: [
      { x: 0.15, y: 0.04, w: 0.7, h: 0.46 },
      { x: 0.15, y: 0.5, w: 0.7, h: 0.46 },
    ],
  },
  {
    id: "curated-2-overlap-tilt",
    itemCount: 2,
    kind: "curated",
    name: "Overlap + tilt",
    cells: [
      { x: 0.04, y: 0.1, w: 0.55, h: 0.78, rotation: -3 },
      { x: 0.45, y: 0.18, w: 0.5, h: 0.66, rotation: 4 },
    ],
  },

  // ─── 3 items ────────────────────────────────────────────────────
  {
    id: "curated-3-three-across",
    itemCount: 3,
    kind: "curated",
    name: "Three across",
    cells: [
      { x: 0, y: 0.13, w: 1 / 3, h: 0.74 },
      { x: 1 / 3, y: 0.13, w: 1 / 3, h: 0.74 },
      { x: 2 / 3, y: 0.13, w: 1 / 3, h: 0.74 },
    ],
  },
  {
    id: "curated-3-three-stacked",
    itemCount: 3,
    kind: "curated",
    name: "Three stacked",
    cells: [
      { x: 0.13, y: 0, w: 0.74, h: 1 / 3 },
      { x: 0.13, y: 1 / 3, w: 0.74, h: 1 / 3 },
      { x: 0.13, y: 2 / 3, w: 0.74, h: 1 / 3 },
    ],
  },
  {
    id: "curated-3-feature-plus-pair",
    itemCount: 3,
    kind: "curated",
    name: "Feature + pair",
    cells: [
      { x: 0, y: 0, w: 0.6, h: 1 },
      { x: 0.6, y: 0, w: 0.4, h: 0.5 },
      { x: 0.6, y: 0.5, w: 0.4, h: 0.5 },
    ],
  },
  {
    id: "curated-3-l-shape",
    itemCount: 3,
    kind: "curated",
    name: "L-shape",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "curated-3-pinwheel",
    itemCount: 3,
    kind: "curated",
    name: "Pinwheel",
    cells: [
      { x: 0.05, y: 0.05, w: 0.55, h: 0.55, rotation: -3 },
      { x: 0.5, y: 0.18, w: 0.45, h: 0.5, rotation: 3 },
      { x: 0.18, y: 0.55, w: 0.6, h: 0.4, rotation: -2 },
    ],
  },

  // ─── 4 items ────────────────────────────────────────────────────
  {
    id: "curated-4-grid-2x2",
    itemCount: 4,
    kind: "curated",
    name: "2 × 2 grid",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "curated-4-strip-tall",
    itemCount: 4,
    kind: "curated",
    name: "Four across",
    cells: [
      { x: 0, y: 0.18, w: 0.25, h: 0.64 },
      { x: 0.25, y: 0.18, w: 0.25, h: 0.64 },
      { x: 0.5, y: 0.18, w: 0.25, h: 0.64 },
      { x: 0.75, y: 0.18, w: 0.25, h: 0.64 },
    ],
  },
  {
    id: "curated-4-hero-plus-three",
    itemCount: 4,
    kind: "curated",
    name: "Hero + three",
    cells: [
      { x: 0, y: 0, w: 0.65, h: 1 },
      { x: 0.65, y: 0, w: 0.35, h: 1 / 3 },
      { x: 0.65, y: 1 / 3, w: 0.35, h: 1 / 3 },
      { x: 0.65, y: 2 / 3, w: 0.35, h: 1 / 3 },
    ],
  },
  {
    id: "curated-4-cross",
    itemCount: 4,
    kind: "curated",
    name: "Cross",
    cells: [
      { x: 0.3, y: 0, w: 0.4, h: 0.35 },
      { x: 0, y: 0.3, w: 0.35, h: 0.4 },
      { x: 0.65, y: 0.3, w: 0.35, h: 0.4 },
      { x: 0.3, y: 0.65, w: 0.4, h: 0.35 },
    ],
  },
  {
    id: "curated-4-staggered",
    itemCount: 4,
    kind: "curated",
    name: "Staggered",
    cells: [
      { x: 0.04, y: 0.04, w: 0.46, h: 0.5 },
      { x: 0.5, y: 0.04, w: 0.46, h: 0.4 },
      { x: 0.04, y: 0.54, w: 0.46, h: 0.42 },
      { x: 0.5, y: 0.44, w: 0.46, h: 0.52 },
    ],
  },

  // ─── 5 items ────────────────────────────────────────────────────
  {
    id: "curated-5-2-over-3",
    itemCount: 5,
    kind: "curated",
    name: "2 over 3",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    ],
  },
  {
    id: "curated-5-hero-strip",
    itemCount: 5,
    kind: "curated",
    name: "Hero + strip",
    cells: [
      { x: 0, y: 0, w: 1, h: 0.65 },
      { x: 0, y: 0.65, w: 0.25, h: 0.35 },
      { x: 0.25, y: 0.65, w: 0.25, h: 0.35 },
      { x: 0.5, y: 0.65, w: 0.25, h: 0.35 },
      { x: 0.75, y: 0.65, w: 0.25, h: 0.35 },
    ],
  },
  {
    id: "curated-5-cluster",
    itemCount: 5,
    kind: "curated",
    name: "Cluster",
    cells: [
      { x: 0, y: 0, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0.05, w: 0.5, h: 0.45 },
      { x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "curated-5-cross-center",
    itemCount: 5,
    kind: "curated",
    name: "Plus sign",
    cells: [
      { x: 0.3, y: 0, w: 0.4, h: 0.3 },
      { x: 0, y: 0.3, w: 0.3, h: 0.4 },
      { x: 0.3, y: 0.3, w: 0.4, h: 0.4 },
      { x: 0.7, y: 0.3, w: 0.3, h: 0.4 },
      { x: 0.3, y: 0.7, w: 0.4, h: 0.3 },
    ],
  },
  {
    id: "curated-5-zigzag",
    itemCount: 5,
    kind: "curated",
    name: "Zigzag",
    cells: [
      { x: 0, y: 0, w: 0.55, h: 0.4 },
      { x: 0.55, y: 0, w: 0.45, h: 0.3 },
      { x: 0.45, y: 0.3, w: 0.55, h: 0.4 },
      { x: 0, y: 0.4, w: 0.45, h: 0.3 },
      { x: 0, y: 0.7, w: 1, h: 0.3 },
    ],
  },

  // ─── 6 items ────────────────────────────────────────────────────
  {
    id: "curated-6-grid-3x2",
    itemCount: 6,
    kind: "curated",
    name: "3 × 2 grid",
    cells: [
      { x: 0, y: 0, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 0.5 },
      { x: 0, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 1 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
      { x: 2 / 3, y: 0.5, w: 1 / 3, h: 0.5 },
    ],
  },
  {
    id: "curated-6-grid-2x3",
    itemCount: 6,
    kind: "curated",
    name: "2 × 3 tall",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 0, w: 0.5, h: 1 / 3 },
      { x: 0, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 1 / 3, w: 0.5, h: 1 / 3 },
      { x: 0, y: 2 / 3, w: 0.5, h: 1 / 3 },
      { x: 0.5, y: 2 / 3, w: 0.5, h: 1 / 3 },
    ],
  },
  {
    id: "curated-6-hero-plus-five",
    itemCount: 6,
    kind: "curated",
    name: "Hero + five",
    cells: [
      { x: 0, y: 0, w: 0.6, h: 0.7 },
      { x: 0.6, y: 0, w: 0.4, h: 0.35 },
      { x: 0.6, y: 0.35, w: 0.4, h: 0.35 },
      { x: 0, y: 0.7, w: 1 / 3, h: 0.3 },
      { x: 1 / 3, y: 0.7, w: 1 / 3, h: 0.3 },
      { x: 2 / 3, y: 0.7, w: 1 / 3, h: 0.3 },
    ],
  },
  {
    id: "curated-6-magazine",
    itemCount: 6,
    kind: "curated",
    name: "Magazine spread",
    cells: [
      { x: 0, y: 0, w: 0.5, h: 0.5 },
      { x: 0.5, y: 0, w: 0.25, h: 0.5 },
      { x: 0.75, y: 0, w: 0.25, h: 0.5 },
      { x: 0, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.25, y: 0.5, w: 0.25, h: 0.5 },
      { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: "curated-6-asymmetric",
    itemCount: 6,
    kind: "curated",
    name: "Asymmetric",
    cells: [
      { x: 0, y: 0, w: 0.4, h: 0.6 },
      { x: 0.4, y: 0, w: 0.6, h: 0.3 },
      { x: 0.4, y: 0.3, w: 0.3, h: 0.3 },
      { x: 0.7, y: 0.3, w: 0.3, h: 0.3 },
      { x: 0, y: 0.6, w: 0.6, h: 0.4 },
      { x: 0.6, y: 0.6, w: 0.4, h: 0.4 },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────
// Algorithmic generator — 5 layouts per item count, deterministic per seed
// ─────────────────────────────────────────────────────────────────────
//
// Recursive binary-partition: start with the full canvas as one rect, then
// repeatedly split the LARGEST rect along its longer axis at a randomized
// ratio (~0.35..0.65) until we have N rects. This always yields a valid
// non-overlapping tiling, with varied proportions but never so extreme that
// items get cut off.

export function generateAlgorithmicLayouts(
  itemCount: LayoutItemCount,
  seed = 0,
): LayoutTemplate[] {
  const layouts: LayoutTemplate[] = [];
  for (let i = 0; i < 5; i++) {
    // Different seed offset per layout so each of the 5 looks distinct.
    const rng = mulberry32(seed * 31 + itemCount * 1009 + i * 7919);
    const cells = partitionCells(itemCount, rng);
    layouts.push({
      id: `algo-${itemCount}-${i}`,
      itemCount,
      kind: "algorithmic",
      name: `Mix ${i + 1}`,
      cells,
    });
  }
  return layouts;
}

/** Deterministic PRNG. Public-domain mulberry32 — same seed → same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function partitionCells(n: number, rng: () => number): LayoutCell[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 0, y: 0, w: 1, h: 1 }];

  let rects: LayoutCell[] = [{ x: 0, y: 0, w: 1, h: 1 }];
  while (rects.length < n) {
    // Find the largest rect by area; that's the one to split.
    rects.sort((a, b) => b.w * b.h - a.w * a.h);
    const r = rects.shift()!;
    // Split along the longer axis to keep aspect ratios reasonable.
    const splitVertical = r.w >= r.h;
    const ratio = 0.35 + rng() * 0.3; // 0.35..0.65
    if (splitVertical) {
      rects.push(
        { x: r.x, y: r.y, w: r.w * ratio, h: r.h },
        { x: r.x + r.w * ratio, y: r.y, w: r.w * (1 - ratio), h: r.h },
      );
    } else {
      rects.push(
        { x: r.x, y: r.y, w: r.w, h: r.h * ratio },
        { x: r.x, y: r.y + r.h * ratio, w: r.w, h: r.h * (1 - ratio) },
      );
    }
  }
  return rects;
}

// ─────────────────────────────────────────────────────────────────────
// Public API — get layouts for current item count
// ─────────────────────────────────────────────────────────────────────

/**
 * Return all layouts available for the given item count: 5 curated + 5
 * algorithmic = 10 total. Curated come first so the UX feels like the
 * carousel always opens with a polished default.
 *
 * `seed` lets the carousel reshuffle algorithmic variants on demand
 * (e.g. "give me 5 different mixes") without touching curated entries.
 */
export function getLayoutsForItemCount(
  itemCount: number,
  seed = 0,
): LayoutTemplate[] {
  if (itemCount < 1 || itemCount > 6) return [];
  const count = itemCount as LayoutItemCount;
  const curated = CURATED_LAYOUTS.filter((l) => l.itemCount === count);
  const algorithmic = generateAlgorithmicLayouts(count, seed);
  return [...curated, ...algorithmic];
}

// ─────────────────────────────────────────────────────────────────────
// Apply a layout to a list of cutouts
// ─────────────────────────────────────────────────────────────────────

/**
 * Given a layout and a list of cutouts, return a new list where each cutout's
 * (x, y, scale, rotation, zIndex) is set to fit its cell.
 *
 * - Cutouts beyond the layout's cell count keep their previous transform but
 *   get pushed to the back (zIndex < 0). UI can then prompt the creator to
 *   either remove them or pick a different layout.
 * - Scale is computed from the cell's smaller dimension. Cutouts in the
 *   collage are anchored at their CENTER and rendered at native_size × scale.
 *   `min(cellW, cellH) * 0.95` produces a fit with ~5% padding inside the cell
 *   and works empirically well for clothing photos where the subject typically
 *   occupies most of the image.
 */
export function applyLayoutToCutouts(
  layout: LayoutTemplate,
  cutouts: CutoutLayer[],
): CutoutLayer[] {
  return cutouts.map((cutout, i) => {
    const cell = layout.cells[i];
    if (!cell) {
      // More cutouts than cells — push to back, keep original position.
      return { ...cutout, zIndex: -1 };
    }
    const cellCenterX = (cell.x + cell.w / 2) * CANVAS_SIZE;
    const cellCenterY = (cell.y + cell.h / 2) * CANVAS_SIZE;
    const cellW = cell.w * CANVAS_SIZE;
    const cellH = cell.h * CANVAS_SIZE;
    const scale = (Math.min(cellW, cellH) / CANVAS_SIZE) * 0.95;
    return {
      ...cutout,
      x: cellCenterX,
      y: cellCenterY,
      scale,
      rotation: cell.rotation ?? 0,
      zIndex: i,
    };
  });
}

/**
 * Render a tiny SVG-ready preview of a layout for use in the carousel
 * thumbnail. Returns a list of rectangles in 0..1 space; consumers scale
 * to whatever size the thumbnail occupies.
 */
export function layoutPreviewRects(layout: LayoutTemplate): LayoutCell[] {
  // For now the preview is just the cells; rotation is included so the
  // thumbnail matches what the canvas will look like.
  return layout.cells;
}
