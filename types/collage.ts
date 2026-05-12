/**
 * Collage layout types — mirrors the JSONB stored in looks.collage_layout.
 *
 * Coordinate space is 1080×1080 (the iOS canvas size). Web renders at a
 * smaller display size and scales input/output via CANVAS_SIZE.
 *
 * v2: extends the v1 shape additively with photos[], text[], and background:
 *
 * {
 *   "template": "style-journal" | "editorial" | "grid" | "editorial-cover",
 *   "background": "#F8F4EE",                      // v2 (optional)
 *   "items": [                                    // v1 — iOS reads this
 *     { "itemId": "...", "x": ..., "y": ..., "scale": ..., "rotation": ..., "zIndex": ... }
 *   ],
 *   "photos": [                                   // v2 (optional)
 *     { "id": "...", "photoUrl": "...", "x": ..., ... }
 *   ],
 *   "text": [                                     // v2 (optional)
 *     { "id": "...", "text": "...", "fontSize": ..., "color": "...", ... }
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

export type LayerKind = "cutout" | "photo" | "text";
export type FontFamily = "serif" | "sans" | "display";

interface LayerBase {
  /** Unique id within this collage — uuid-like string. */
  id: string;
  kind: LayerKind;
  x: number; // centerpoint, 1080-space
  y: number;
  scale: number; // 0.3..3.0 (text gets a wider range than cutouts)
  rotation: number; // -180..180
  zIndex: number;
}

export interface CutoutLayer extends LayerBase {
  kind: "cutout";
  /** creator_items.id of the underlying piece */
  itemId: string;
}

export interface PhotoLayer extends LayerBase {
  kind: "photo";
  /** Supabase Storage public URL */
  photoUrl: string;
}

export interface TextLayer extends LayerBase {
  kind: "text";
  text: string;
  fontSize: number; // px in 1080-space
  color: string;
  fontFamily: FontFamily;
  bold: boolean;
  italic: boolean;
}

export type Layer = CutoutLayer | PhotoLayer | TextLayer;

export interface CollageLayout {
  template: TemplateId;
  background: string; // hex color, e.g. "#F8F4EE"
  layers: Layer[];
}

// ─────────────── Persistence helpers ───────────────
// DB JSONB shape splits layers by kind for backward compat with iOS.

export interface CollageLayoutJsonV1 {
  template: TemplateId;
  background?: string;
  items: Array<Pick<CutoutLayer, "x" | "y" | "scale" | "rotation" | "zIndex"> & {
    itemId: string;
  }>;
  photos?: Array<Omit<PhotoLayer, "kind">>;
  text?: Array<Omit<TextLayer, "kind">>;
}

export function layoutToJson(layout: CollageLayout): CollageLayoutJsonV1 {
  const items: CollageLayoutJsonV1["items"] = [];
  const photos: NonNullable<CollageLayoutJsonV1["photos"]> = [];
  const text: NonNullable<CollageLayoutJsonV1["text"]> = [];

  for (const layer of layout.layers) {
    if (layer.kind === "cutout") {
      items.push({
        itemId: layer.itemId,
        x: layer.x,
        y: layer.y,
        scale: layer.scale,
        rotation: layer.rotation,
        zIndex: layer.zIndex,
      });
    } else if (layer.kind === "photo") {
      photos.push({
        id: layer.id,
        photoUrl: layer.photoUrl,
        x: layer.x,
        y: layer.y,
        scale: layer.scale,
        rotation: layer.rotation,
        zIndex: layer.zIndex,
      });
    } else {
      text.push({
        id: layer.id,
        text: layer.text,
        fontSize: layer.fontSize,
        color: layer.color,
        fontFamily: layer.fontFamily,
        bold: layer.bold,
        italic: layer.italic,
        x: layer.x,
        y: layer.y,
        scale: layer.scale,
        rotation: layer.rotation,
        zIndex: layer.zIndex,
      });
    }
  }

  return {
    template: layout.template,
    background: layout.background,
    items,
    photos: photos.length > 0 ? photos : undefined,
    text: text.length > 0 ? text : undefined,
  };
}

/**
 * Inverse of layoutToJson — rehydrate a saved CollageLayoutJsonV1 (read from
 * looks.collage_layout) back into the in-memory CollageLayout shape the
 * editor works with.
 *
 * Defensive: each kind is parsed independently, malformed layers are
 * skipped rather than throwing so an edit session never blocks on a
 * stale/partial JSONB row.
 *
 * Returns null when the input doesn't look like a collage at all
 * (no items, no photos, no text) — callers fall back to a fresh
 * blank canvas in that case.
 */
export function jsonToLayout(
  json: unknown,
): CollageLayout | null {
  if (!json || typeof json !== "object") return null;
  const j = json as Partial<CollageLayoutJsonV1>;

  const template: TemplateId = (
    ["style-journal", "editorial", "grid", "editorial-cover"] as TemplateId[]
  ).includes(j.template as TemplateId)
    ? (j.template as TemplateId)
    : "editorial";

  const background =
    typeof j.background === "string" && /^#[0-9a-f]{6}$/i.test(j.background)
      ? j.background
      : getTemplateBackground(template);

  const layers: Layer[] = [];

  if (Array.isArray(j.items)) {
    for (const item of j.items) {
      if (!item || typeof item !== "object") continue;
      if (typeof item.itemId !== "string") continue;
      layers.push({
        id: newLayerId(),
        kind: "cutout",
        itemId: item.itemId,
        x: Number(item.x ?? CANVAS_SIZE / 2),
        y: Number(item.y ?? CANVAS_SIZE / 2),
        scale: Number(item.scale ?? 1),
        rotation: Number(item.rotation ?? 0),
        zIndex: Number(item.zIndex ?? layers.length),
      });
    }
  }

  if (Array.isArray(j.photos)) {
    for (const p of j.photos) {
      if (!p || typeof p !== "object") continue;
      if (typeof p.photoUrl !== "string") continue;
      layers.push({
        id: typeof p.id === "string" ? p.id : newLayerId(),
        kind: "photo",
        photoUrl: p.photoUrl,
        x: Number(p.x ?? CANVAS_SIZE / 2),
        y: Number(p.y ?? CANVAS_SIZE / 2),
        scale: Number(p.scale ?? 1),
        rotation: Number(p.rotation ?? 0),
        zIndex: Number(p.zIndex ?? layers.length),
      });
    }
  }

  if (Array.isArray(j.text)) {
    for (const t of j.text) {
      if (!t || typeof t !== "object") continue;
      if (typeof t.text !== "string") continue;
      layers.push({
        id: typeof t.id === "string" ? t.id : newLayerId(),
        kind: "text",
        text: t.text,
        fontSize: Number(t.fontSize ?? DEFAULT_TEXT_FONT_SIZE),
        color: typeof t.color === "string" ? t.color : DEFAULT_TEXT_COLOR,
        fontFamily: (["serif", "sans", "display"] as FontFamily[]).includes(
          t.fontFamily as FontFamily,
        )
          ? (t.fontFamily as FontFamily)
          : "display",
        bold: Boolean(t.bold),
        italic: Boolean(t.italic),
        x: Number(t.x ?? CANVAS_SIZE / 2),
        y: Number(t.y ?? CANVAS_SIZE / 2),
        scale: Number(t.scale ?? 1),
        rotation: Number(t.rotation ?? 0),
        zIndex: Number(t.zIndex ?? layers.length),
      });
    }
  }

  if (layers.length === 0) return null;

  return { template, background, layers };
}

// ─────────────── Templates ───────────────

export interface TemplateOption {
  id: TemplateId;
  label: string;
  description: string;
  background: string;
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    id: "style-journal",
    label: "Style journal",
    description:
      "Editorial column on cream paper — items stacked with subtle drift.",
    background: "#F1E9DB", // warm cream paper
  },
  {
    id: "editorial",
    label: "Editorial",
    description: "Crisp white — one featured piece, others orbiting.",
    background: "#FAFAF7", // off-white
  },
  {
    id: "grid",
    label: "Grid",
    description: "Soft warm gray — clean 2×N catalog layout.",
    background: "#E8E5E0", // warm gray
  },
  {
    id: "editorial-cover",
    label: "Editorial cover",
    description: "Blush full-bleed — for centerpiece + look-photo collages.",
    background: "#F4D8CD", // muted blush
  },
];

export function getTemplateBackground(template: TemplateId): string {
  return TEMPLATE_OPTIONS.find((t) => t.id === template)?.background ?? "#F8F4EE";
}

// ─────────────── ID + defaults ───────────────

export function newLayerId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `layer-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const DEFAULT_TEXT_FONT_SIZE = 96; // 1080-space
export const DEFAULT_TEXT_COLOR = "#1A1A1A";
export const TEXT_COLOR_PRESETS = [
  "#1A1A1A", // ink
  "#FFFFFF", // white
  "#B53D2A", // brand rose
  "#A4845A", // tan
  "#3F4A2D", // moss
  "#5D6E89", // dusk blue
];

export function makeDefaultTextLayer(zIndex: number): TextLayer {
  return {
    id: newLayerId(),
    kind: "text",
    text: "Tap to edit",
    x: CANVAS_SIZE / 2,
    y: CANVAS_SIZE / 2,
    scale: 1,
    rotation: 0,
    zIndex,
    fontSize: DEFAULT_TEXT_FONT_SIZE,
    color: DEFAULT_TEXT_COLOR,
    fontFamily: "display",
    bold: false,
    italic: false,
  };
}
