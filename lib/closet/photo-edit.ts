"use client";

/**
 * In-frame photo crop renderer. Takes a source image URL, a 4:5 frame, and
 * the user's drag/zoom transform; renders the visible region into a fixed-
 * resolution PNG suitable for upload to item-photos.
 *
 * Coordinate model (matches PhotoFrameEditor):
 *   - frame is `frameW × frameH` display pixels (4:5 aspect)
 *   - image at scale=1 cover-fits the frame
 *   - scale (1.0..MAX_ZOOM) zooms in
 *   - translateX/Y (display pixels) shifts the image inside the frame
 */

export const FRAME_W = 320;
export const FRAME_H = 400;
export const FRAME_ASPECT = FRAME_W / FRAME_H; // 4:5
export const MIN_ZOOM = 1.0;
export const MAX_ZOOM = 3.5;

export const OUTPUT_W = 800;
export const OUTPUT_H = 1000;

export interface PhotoTransform {
  scale: number;
  translateX: number;
  translateY: number;
}

export const IDENTITY_TRANSFORM: PhotoTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
};

/**
 * Compute the cover-scale factor that makes the source image fully fill
 * the display frame at zoom=1. Returns 1.0 if the image is missing.
 */
export function coverScale(
  imgW: number,
  imgH: number,
  frameW: number = FRAME_W,
  frameH: number = FRAME_H,
): number {
  if (!imgW || !imgH) return 1;
  return Math.max(frameW / imgW, frameH / imgH);
}

/**
 * Render the framed crop into a PNG blob at OUTPUT_W × OUTPUT_H.
 * Background is filled with white so JPEGs with transparent backgrounds
 * (rare for cutouts that pass through here) don't show black.
 */
export async function renderCroppedPhoto(
  imageUrl: string,
  transform: PhotoTransform,
): Promise<Blob> {
  const img = await loadImage(imageUrl);
  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_W;
  canvas.height = OUTPUT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, OUTPUT_W, OUTPUT_H);

  const cover = coverScale(img.naturalWidth, img.naturalHeight);
  const total = cover * transform.scale;
  const dw = img.naturalWidth * total;
  const dh = img.naturalHeight * total;

  // Image center in frame coords
  const cx = FRAME_W / 2 + transform.translateX;
  const cy = FRAME_H / 2 + transform.translateY;

  // Scale up frame coords to output coords
  const scaleRatio = OUTPUT_W / FRAME_W;

  ctx.drawImage(
    img,
    (cx - dw / 2) * scaleRatio,
    (cy - dh / 2) * scaleRatio,
    dw * scaleRatio,
    dh * scaleRatio,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Canvas toBlob returned null.")),
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
      reject(
        new Error(
          `Could not load source image. If the photo is on a merchant CDN that blocks cross-origin reads, re-fetch from URL first to cache it.`,
        ),
      );
    img.src = url;
  });
}
