import {
  CANVAS_SIZE,
  newLayerId,
  type CutoutLayer,
  type Layer,
  type TemplateId,
} from "@/types/collage";

/**
 * Apply a template to existing layers. Cutout layers get repositioned to
 * the template's slot scheme; photo and text layers keep their existing
 * positions (the user can move them deliberately).
 *
 * If you pass an array of itemIds (for the create-from-scratch flow with
 * just cutouts), use applyTemplateToCutouts.
 */
export function applyTemplate(
  template: TemplateId,
  layers: Layer[],
): Layer[] {
  const cutouts = layers.filter((l): l is CutoutLayer => l.kind === "cutout");
  const others = layers.filter((l) => l.kind !== "cutout");
  const repositioned = positionCutouts(template, cutouts);
  return [...repositioned, ...others];
}

export function applyTemplateToCutouts(
  template: TemplateId,
  itemIds: string[],
): CutoutLayer[] {
  const stub: CutoutLayer[] = itemIds.map((itemId, i) => ({
    id: newLayerId(),
    kind: "cutout",
    itemId,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    zIndex: i,
  }));
  return positionCutouts(template, stub);
}

function positionCutouts(
  template: TemplateId,
  cutouts: CutoutLayer[],
): CutoutLayer[] {
  if (cutouts.length === 0) return [];
  switch (template) {
    case "style-journal":
      return styleJournal(cutouts);
    case "editorial":
      return editorial(cutouts);
    case "grid":
      return grid(cutouts);
    case "editorial-cover":
      return editorialCover(cutouts);
  }
}

// ─────────────── Templates ───────────────

/** Vertical column with slight zigzag drift, magazine-feel. */
function styleJournal(cutouts: CutoutLayer[]): CutoutLayer[] {
  const n = cutouts.length;
  const margin = 200;
  const usable = CANVAS_SIZE - margin * 2;
  const stepY = usable / Math.max(n, 1);
  return cutouts.map((c, i) => ({
    ...c,
    x: CANVAS_SIZE / 2 + (i % 2 === 0 ? -60 : 60),
    y: margin + stepY * i + stepY / 2,
    scale: 0.85,
    rotation: i % 2 === 0 ? -3 : 3,
    zIndex: i,
  }));
}

/** Asymmetric layout: featured top-left, others orbit. */
function editorial(cutouts: CutoutLayer[]): CutoutLayer[] {
  const positions = [
    { x: 380, y: 380, scale: 1.3, rotation: 0 },
    { x: 760, y: 320, scale: 0.7, rotation: 6 },
    { x: 800, y: 700, scale: 0.8, rotation: -4 },
    { x: 320, y: 800, scale: 0.65, rotation: 8 },
    { x: 600, y: 540, scale: 0.55, rotation: 0 },
    { x: 250, y: 580, scale: 0.5, rotation: -10 },
  ];
  return cutouts.map((c, i) => {
    const p = positions[i] ?? positions[positions.length - 1];
    return {
      ...c,
      x: p.x,
      y: p.y,
      scale: p.scale,
      rotation: p.rotation,
      zIndex: i === 0 ? 100 : i,
    };
  });
}

function grid(cutouts: CutoutLayer[]): CutoutLayer[] {
  const cols = 2;
  const rows = Math.ceil(cutouts.length / cols);
  const padding = 120;
  const cellW = (CANVAS_SIZE - padding * 2) / cols;
  const cellH = (CANVAS_SIZE - padding * 2) / Math.max(rows, 1);
  return cutouts.map((c, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      ...c,
      x: padding + cellW * col + cellW / 2,
      y: padding + cellH * row + cellH / 2,
      scale: 0.7,
      rotation: 0,
      zIndex: i,
    };
  });
}

/** Single huge centerpiece, smaller pieces in corners. */
function editorialCover(cutouts: CutoutLayer[]): CutoutLayer[] {
  const corners = [
    { x: 220, y: 220, scale: 0.45 },
    { x: 860, y: 220, scale: 0.45 },
    { x: 860, y: 860, scale: 0.45 },
    { x: 220, y: 860, scale: 0.45 },
    { x: 540, y: 200, scale: 0.4 },
  ];
  return cutouts.map((c, i) => {
    if (i === 0) {
      return {
        ...c,
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        scale: 1.5,
        rotation: 0,
        zIndex: 100,
      };
    }
    const p = corners[(i - 1) % corners.length];
    return {
      ...c,
      x: p.x,
      y: p.y,
      scale: p.scale,
      rotation: 0,
      zIndex: i,
    };
  });
}
