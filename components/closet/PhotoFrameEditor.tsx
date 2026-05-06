"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X, RotateCcw } from "lucide-react";
import {
  FRAME_W,
  FRAME_H,
  MIN_ZOOM,
  MAX_ZOOM,
  type PhotoTransform,
  IDENTITY_TRANSFORM,
  coverScale,
} from "@/lib/closet/photo-edit";

interface Props {
  /** Source photo URL — will be loaded with crossOrigin='anonymous' so the
   *  canvas render later doesn't taint. Cached Supabase Storage URLs work;
   *  raw merchant CDN URLs may not. */
  imageUrl: string;
  /** Called when user clicks Apply with the final transform. The parent
   *  is responsible for calling renderCroppedPhoto + uploading. */
  onApply: (transform: PhotoTransform) => Promise<void> | void;
  onCancel: () => void;
  /** Disable interaction (e.g. while parent is uploading). */
  busy?: boolean;
}

export function PhotoFrameEditor({
  imageUrl,
  onApply,
  onCancel,
  busy,
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [transform, setTransform] = useState<PhotoTransform>(IDENTITY_TRANSFORM);
  const [imgDims, setImgDims] = useState<{ w: number; h: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Pre-load the image to get natural dimensions so the in-frame transform
  // can compute cover scale without flicker.
  useEffect(() => {
    setLoadError(null);
    setImgDims(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (img.naturalWidth && img.naturalHeight) {
        setImgDims({ w: img.naturalWidth, h: img.naturalHeight });
      }
    };
    img.onerror = () =>
      setLoadError(
        "Couldn't load this photo for editing. Try Re-fetch first to cache it.",
      );
    img.src = imageUrl;
  }, [imageUrl]);

  const cover = imgDims ? coverScale(imgDims.w, imgDims.h) : 1;
  const displayedW = imgDims ? imgDims.w * cover * transform.scale : 0;
  const displayedH = imgDims ? imgDims.h * cover * transform.scale : 0;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (busy) return;
    e.preventDefault();
    dragRef.current = {
      startClientX: e.clientX,
      startClientY: e.clientY,
      origX: transform.translateX,
      origY: transform.translateY,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startClientX;
    const dy = e.clientY - dragRef.current.startClientY;
    setTransform((prev) => ({
      ...prev,
      translateX: dragRef.current!.origX + dx,
      translateY: dragRef.current!.origY + dy,
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
    dragRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (busy) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setTransform((prev) => ({
      ...prev,
      scale: clamp(prev.scale + delta, MIN_ZOOM, MAX_ZOOM),
    }));
  };

  const handleReset = () => setTransform(IDENTITY_TRANSFORM);

  const handleApply = async () => {
    if (loadError || !imgDims) return;
    await onApply(transform);
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-muted">
          Crop & reposition
        </p>
        <button
          type="button"
          onClick={handleReset}
          disabled={busy}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-text disabled:opacity-40"
        >
          <RotateCcw size={11} strokeWidth={2} />
          Reset
        </button>
      </div>

      {loadError ? (
        <div className="text-xs text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-3 py-2">
          {loadError}
        </div>
      ) : null}

      <div
        ref={frameRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        className="relative mx-auto rounded-xl overflow-hidden bg-bg cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ width: FRAME_W, height: FRAME_H, maxWidth: "100%" }}
      >
        {imgDims ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt="Crop source"
            crossOrigin="anonymous"
            draggable={false}
            className="absolute pointer-events-none"
            style={{
              width: displayedW,
              height: displayedH,
              left: FRAME_W / 2 - displayedW / 2 + transform.translateX,
              top: FRAME_H / 2 - displayedH / 2 + transform.translateY,
              maxWidth: "none",
            }}
          />
        ) : !loadError ? (
          <div className="absolute inset-0 grid place-items-center text-xs text-muted">
            Loading…
          </div>
        ) : null}

        {/* Optional rule-of-thirds overlay for alignment */}
        {imgDims ? (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <div className="absolute inset-y-0 left-2/3 w-px bg-white/30" />
            <div className="absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <div className="absolute inset-x-0 top-2/3 h-px bg-white/30" />
          </div>
        ) : null}
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Zoom</span>
          <span>{transform.scale.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.05}
          value={transform.scale}
          disabled={busy || !imgDims}
          onChange={(e) =>
            setTransform((prev) => ({
              ...prev,
              scale: Number.parseFloat(e.target.value),
            }))
          }
          className="w-full accent-rose"
        />
      </div>
      <p className="text-xs text-muted leading-snug">
        Drag the photo to reposition. Use the slider or scroll wheel to zoom.
        Output saves as 800×1000.
      </p>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-4 py-1.5 text-sm hover:border-rose disabled:opacity-60"
        >
          <X size={14} strokeWidth={2} />
          Cancel
        </button>
        <button
          type="button"
          onClick={handleApply}
          disabled={busy || !imgDims || !!loadError}
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
        >
          <Check size={14} strokeWidth={2} />
          {busy ? "Applying…" : "Apply"}
        </button>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
