/**
 * Collage layout types — mirrors the JSONB stored in looks.collage_layout.
 *
 * Coordinate space is 1080×1080 (the iOS canvas size). Web renders at a
 * smaller display size and scales input/output via CANVAS_SIZE.
 *
 * Shape persisted to DB:
 * {
 *   "template": "style-journal" | "editorial" | "grid" | "editorial-cover",
 *   "items": [
 *     { "itemId": "...", "x": 0..1080, "y": 0..1080, "scale": 0.3..2.5,
 *       "rotation": -180..180, "zIndex": int }
 *   ]
 * }
 */

export const CANVAS_SIZE = 1080;
export const DISPLAY_SIZE = 540;
export const DISPLAY_SCALE = DISPLAY_SIZE / CANVAS_SIZE;

export type TemplateId =
  | "style-journal"
  | "editorial"
  | "grid"
  | "editorial-cover";

export interface CollageItemTransform {
  /** creator_items.id of the underlying piece */
  itemId: string;
  /** Centerpoint x in 1080-space */
  x: number;
  /** Centerpoint y in 1080-space */
  y: number;
  /** 1.0 = natural size at 360px-square base, 0.3..2.5 reasonable range */
  scale: number;
  /** Degrees, -180..180 */
  rotation: number;
  /** Stacking order; higher = on top */
  zIndex: number;
}

export interface CollageLayout {
  template: TemplateId;
  items: CollageItemTransform[];
}

export const TEMPLATE_OPTIONS: Array<{
  id: TemplateId;
  label: string;
  description: string;
}> = [
  {
    id: "style-journal",
    label: "Style journal",
    description: "Editorial column — items stacked vertically with subtle drift.",
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Asymmetric — one featured piece, others orbiting.",
  },
  {
    id: "grid",
    label: "Grid",
    description: "Clean 2×N grid for catalog-feel layouts.",
  },
  {
    id: "editorial-cover",
    label: "Editorial cover",
    description: "Full-bleed centerpiece with smaller accents.",
  },
];
