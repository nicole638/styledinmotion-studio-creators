import {
  CANVAS_SIZE,
  type CollageItemTransform,
  type TemplateId,
} from "@/types/collage";

/**
 * Apply a template to a list of item IDs, returning starting transforms.
 * The user then drags/scales/rotates from the template baseline.
 *
 * All numbers are in 1080-space.
 */
export function applyTemplate(
  template: TemplateId,
  itemIds: string[],
): CollageItemTransform[] {
  if (itemIds.length === 0) return [];

  switch (template) {
    case "style-journal":
      return styleJournal(itemIds);
    case "editorial":
      return editorial(itemIds);
    case "grid":
      return grid(itemIds);
    case "editorial-cover":
      return editorialCover(itemIds);
  }
}

// ─────────────────────────────────────────────────────────────────
// Templates — return positions for the items in the order given.
// First item = "primary" / featured spot in templates that have one.
// ─────────────────────────────────────────────────────────────────

/** Vertical column with slight zigzag drift, magazine-feel. */
function styleJournal(itemIds: string[]): CollageItemTransform[] {
  const n = itemIds.length;
  const margin = 200;
  const usable = CANVAS_SIZE - margin * 2;
  const stepY = usable / Math.max(n, 1);
  return itemIds.map((id, i) => ({
    itemId: id,
    x: CANVAS_SIZE / 2 + (i % 2 === 0 ? -60 : 60),
    y: margin + stepY * i + stepY / 2,
    scale: 0.85,
    rotation: i % 2 === 0 ? -3 : 3,
    zIndex: i,
  }));
}

/** Asymmetric layout: featured top-left, others orbit. */
function editorial(itemIds: string[]): CollageItemTransform[] {
  const positions = [
    { x: 380, y: 380, scale: 1.3, rotation: 0 }, // featured
    { x: 760, y: 320, scale: 0.7, rotation: 6 },
    { x: 800, y: 700, scale: 0.8, rotation: -4 },
    { x: 320, y: 800, scale: 0.65, rotation: 8 },
    { x: 600, y: 540, scale: 0.55, rotation: 0 },
    { x: 250, y: 580, scale: 0.5, rotation: -10 },
  ];
  return itemIds.map((id, i) => {
    const p = positions[i] ?? positions[positions.length - 1];
    return {
      itemId: id,
      x: p.x,
      y: p.y,
      scale: p.scale,
      rotation: p.rotation,
      zIndex: i === 0 ? 100 : i, // featured on top
    };
  });
}

/** Clean 2-column grid. Up to 6 items in 2×3. */
function grid(itemIds: string[]): CollageItemTransform[] {
  const cols = 2;
  const rows = Math.ceil(itemIds.length / cols);
  const padding = 120;
  const cellW = (CANVAS_SIZE - padding * 2) / cols;
  const cellH = (CANVAS_SIZE - padding * 2) / Math.max(rows, 1);
  return itemIds.map((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      itemId: id,
      x: padding + cellW * col + cellW / 2,
      y: padding + cellH * row + cellH / 2,
      scale: 0.7,
      rotation: 0,
      zIndex: i,
    };
  });
}

/** Single huge centerpiece, smaller pieces tucked into corners. */
function editorialCover(itemIds: string[]): CollageItemTransform[] {
  const corners = [
    { x: 220, y: 220, scale: 0.45 }, // tl
    { x: 860, y: 220, scale: 0.45 }, // tr
    { x: 860, y: 860, scale: 0.45 }, // br
    { x: 220, y: 860, scale: 0.45 }, // bl
    { x: 540, y: 200, scale: 0.4 }, // top mid
  ];
  return itemIds.map((id, i) => {
    if (i === 0) {
      return {
        itemId: id,
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        scale: 1.5,
        rotation: 0,
        zIndex: 100,
      };
    }
    const p = corners[(i - 1) % corners.length];
    return {
      itemId: id,
      x: p.x,
      y: p.y,
      scale: p.scale,
      rotation: 0,
      zIndex: i,
    };
  });
}
