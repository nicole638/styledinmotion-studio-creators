"use client";

import { CANVAS_SIZE, type CollageItemTransform } from "@/types/collage";

const ITEM_BASE_SIZE = 360; // 1080-space natural size before scale

interface RenderInput {
  itemId: string;
  imageUrl: string;
  transform: CollageItemTransform;
}

/**
 * Flatten the collage into a 1080×1080 PNG blob using an offscreen canvas.
 * Images are loaded with crossOrigin='anonymous' so they don't taint the
 * canvas — Supabase Storage public URLs serve the right CORS headers.
 *
 * If any image fails to load (e.g. a CDN that doesn't allow CORS),
 * renderCollageToPng will throw and the caller should surface the error
 * rather than save a partial result.
 */
export async function renderCollageToPng(
  inputs: RenderInput[],
  opts: { background?: string } = {},
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  // Background — default subtle warm card color matching the rest of the UI
  ctx.fillStyle = opts.background ?? "#F8F4EE";
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Load all images in parallel before drawing
  const sorted = [...inputs].sort(
    (a, b) => a.transform.zIndex - b.transform.zIndex,
  );
  const loaded = await Promise.all(
    sorted.map((it) =>
      loadImage(it.imageUrl).then((img) => ({ it, img })),
    ),
  );

  for (const { it, img } of loaded) {
    drawItem(ctx, img, it.transform);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Canvas toBlob returned null."));
      },
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
    img.onerror = () =>
      reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}

function drawItem(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  t: CollageItemTransform,
) {
  // Compute display bounds preserving aspect ratio inside ITEM_BASE_SIZE
  const aspect = img.naturalWidth / img.naturalHeight;
  let w = ITEM_BASE_SIZE;
  let h = ITEM_BASE_SIZE;
  if (aspect >= 1) {
    h = ITEM_BASE_SIZE / aspect;
  } else {
    w = ITEM_BASE_SIZE * aspect;
  }
  w *= t.scale;
  h *= t.scale;

  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate((t.rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
}

/** Display-space (540×540) item box — used by the editor for hit testing. */
export function itemDisplaySize(
  imgAspect: number,
  scale: number,
  displayScale: number,
) {
  const baseDisp = ITEM_BASE_SIZE * displayScale;
  let w = baseDisp;
  let h = baseDisp;
  if (imgAspect >= 1) h = baseDisp / imgAspect;
  else w = baseDisp * imgAspect;
  return { w: w * scale, h: h * scale };
}
