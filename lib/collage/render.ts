"use client";

import {
  CANVAS_SIZE,
  type CutoutLayer,
  type Layer,
  type PhotoLayer,
  type TextLayer,
} from "@/types/collage";

const ITEM_BASE_SIZE = 360; // 1080-space natural size before scale (cutouts)
const PHOTO_BASE_SIZE = 720; // 1080-space natural size before scale (photos default larger)

interface RenderInput {
  layers: Layer[];
  /** Map of cutout itemId → image URL (cutout_photo_url). Required for cutout layers. */
  cutoutUrls: Map<string, string>;
  background: string;
}

/**
 * Flatten the collage into a 1080×1080 PNG blob via offscreen canvas.
 *
 * Layers render in zIndex order (low to high). Cutout + photo images are
 * loaded with crossOrigin='anonymous' so the canvas isn't tainted —
 * Supabase Storage public URLs serve the right CORS headers.
 *
 * Text layers are drawn directly via fillText with rotation/scale.
 */
export async function renderCollageToPng(
  input: RenderInput,
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  ctx.fillStyle = input.background;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Sort by zIndex ascending so highest zIndex paints last (on top)
  const sorted = [...input.layers].sort((a, b) => a.zIndex - b.zIndex);

  // Pre-load all images we'll need (cutouts + photos)
  const imageLayers = sorted.filter(
    (l): l is CutoutLayer | PhotoLayer => l.kind !== "text",
  );
  const loadedImages = new Map<string, HTMLImageElement>();
  await Promise.all(
    imageLayers.map(async (layer) => {
      const url =
        layer.kind === "cutout"
          ? input.cutoutUrls.get(layer.itemId)
          : layer.photoUrl;
      if (!url) return;
      try {
        const img = await loadImage(url);
        loadedImages.set(layer.id, img);
      } catch (e) {
        // Re-throw with layer context so the caller can surface a useful message
        throw new Error(`Could not load image for layer ${layer.id}: ${(e as Error).message}`);
      }
    }),
  );

  for (const layer of sorted) {
    if (layer.kind === "text") {
      drawText(ctx, layer);
    } else {
      const img = loadedImages.get(layer.id);
      if (!img) continue;
      drawImageLayer(ctx, img, layer);
    }
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob returned null."))),
      "image/png",
      0.95,
    );
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function drawImageLayer(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  layer: CutoutLayer | PhotoLayer,
) {
  const aspect = img.naturalWidth / img.naturalHeight;
  const baseSize = layer.kind === "cutout" ? ITEM_BASE_SIZE : PHOTO_BASE_SIZE;
  let w = baseSize;
  let h = baseSize;
  if (aspect >= 1) h = baseSize / aspect;
  else w = baseSize * aspect;
  w *= layer.scale;
  h *= layer.scale;

  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawText(ctx: CanvasRenderingContext2D, layer: TextLayer) {
  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  const family = fontFamilyToCss(layer.fontFamily);
  const weight = layer.bold ? "700" : "400";
  const style = layer.italic ? "italic" : "normal";
  ctx.font = `${style} ${weight} ${layer.fontSize}px ${family}`;
  ctx.fillStyle = layer.color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Multi-line support: split on newline and stack
  const lines = layer.text.split("\n");
  const lineHeight = layer.fontSize * 1.2;
  const totalH = lineHeight * lines.length;
  const startY = -totalH / 2 + lineHeight / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, 0, startY + i * lineHeight);
  });

  ctx.restore();
}

export function fontFamilyToCss(family: TextLayer["fontFamily"]): string {
  switch (family) {
    case "serif":
      return '"Cormorant Garamond", "EB Garamond", Georgia, serif';
    case "sans":
      return '"Inter", "Helvetica Neue", Arial, sans-serif';
    case "display":
      return '"Bodoni Moda", "Playfair Display", "Didot", "Cormorant Garamond", serif';
  }
}

/** Display-space layer dimensions for hit-testing in the editor. */
export function imageLayerSize(
  imgAspect: number,
  scale: number,
  displayScale: number,
  baseSize: number,
) {
  const baseDisp = baseSize * displayScale;
  let w = baseDisp;
  let h = baseDisp;
  if (imgAspect >= 1) h = baseDisp / imgAspect;
  else w = baseDisp * imgAspect;
  return { w: w * scale, h: h * scale };
}

export const CUTOUT_BASE_SIZE = ITEM_BASE_SIZE;
export const PHOTO_LAYER_BASE_SIZE = PHOTO_BASE_SIZE;
