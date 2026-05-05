"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import {
  CANVAS_SIZE,
  DISPLAY_SIZE,
  DISPLAY_SCALE,
  type CollageItemTransform,
} from "@/types/collage";
import type { ClosetItem } from "@/types/closet";

interface Props {
  items: CollageItemTransform[];
  /** Closet items keyed by id — used to look up cutout/photo URLs. */
  itemsById: Map<string, ClosetItem>;
  selectedId: string | null;
  onSelectionChange: (id: string | null) => void;
  onTransformChange: (id: string, next: Partial<CollageItemTransform>) => void;
  onRemove: (id: string) => void;
  onZIndexShift: (id: string, direction: "up" | "down") => void;
}

const ITEM_BASE_SIZE = 360; // 1080-space; mirrors lib/collage/render.ts

export function CollageCanvas({
  items,
  itemsById,
  selectedId,
  onSelectionChange,
  onTransformChange,
  onRemove,
  onZIndexShift,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  // Cache image aspect ratios so the box rendering matches the eventual
  // canvas flatten dimensions exactly.
  const [aspects, setAspects] = useState<Record<string, number>>({});

  useEffect(() => {
    items.forEach((it) => {
      if (aspects[it.itemId]) return;
      const item = itemsById.get(it.itemId);
      const url = item?.photoUrl;
      if (!url) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setAspects((prev) => ({
            ...prev,
            [it.itemId]: img.naturalWidth / img.naturalHeight,
          }));
        }
      };
      img.src = url;
    });
  }, [items, itemsById, aspects]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectionChange(id);
    const tr = items.find((it) => it.itemId === id);
    if (!tr) return;
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: tr.x,
      origY: tr.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / DISPLAY_SCALE;
    const dy = (e.clientY - dragRef.current.startY) / DISPLAY_SCALE;
    onTransformChange(dragRef.current.id, {
      x: clamp(dragRef.current.origX + dx, 0, CANVAS_SIZE),
      y: clamp(dragRef.current.origY + dy, 0, CANVAS_SIZE),
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragRef.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    }
    dragRef.current = null;
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Click on empty canvas deselects
    if (e.target === canvasRef.current) onSelectionChange(null);
  };

  return (
    <div className="space-y-4">
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="relative mx-auto rounded-2xl overflow-hidden border border-border shadow-sm"
        style={{
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          backgroundColor: "#F8F4EE",
        }}
      >
        {items.map((tr) => {
          const closet = itemsById.get(tr.itemId);
          const url = closet?.photoUrl;
          if (!url) return null;

          const aspect = aspects[tr.itemId] ?? 1;
          const baseDisplay = ITEM_BASE_SIZE * DISPLAY_SCALE;
          let w = baseDisplay;
          let h = baseDisplay;
          if (aspect >= 1) h = baseDisplay / aspect;
          else w = baseDisplay * aspect;
          w *= tr.scale;
          h *= tr.scale;

          const isSelected = selectedId === tr.itemId;
          const left = tr.x * DISPLAY_SCALE - w / 2;
          const top = tr.y * DISPLAY_SCALE - h / 2;

          return (
            <div
              key={tr.itemId}
              onPointerDown={(e) => handlePointerDown(e, tr.itemId)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`absolute cursor-move touch-none select-none ${
                isSelected ? "ring-2 ring-rose ring-offset-2 ring-offset-bg" : ""
              }`}
              style={{
                left,
                top,
                width: w,
                height: h,
                transform: `rotate(${tr.rotation}deg)`,
                zIndex: tr.zIndex,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={closet?.name ?? "Piece"}
                draggable={false}
                crossOrigin="anonymous"
                className="w-full h-full object-contain pointer-events-none"
              />
            </div>
          );
        })}
      </div>

      {/* Selected item controls */}
      {selectedId ? (
        <SelectedItemControls
          transform={items.find((it) => it.itemId === selectedId)!}
          item={itemsById.get(selectedId)}
          onTransformChange={(next) =>
            onTransformChange(selectedId, next)
          }
          onRemove={() => {
            onRemove(selectedId);
            onSelectionChange(null);
          }}
          onZIndexShift={(direction) => onZIndexShift(selectedId, direction)}
        />
      ) : (
        <p className="text-xs text-muted text-center">
          Tap a piece to select. Drag to move, use sliders below to scale and
          rotate.
        </p>
      )}
    </div>
  );
}

interface ControlsProps {
  transform: CollageItemTransform;
  item?: ClosetItem;
  onTransformChange: (next: Partial<CollageItemTransform>) => void;
  onRemove: () => void;
  onZIndexShift: (direction: "up" | "down") => void;
}

function SelectedItemControls({
  transform,
  item,
  onTransformChange,
  onRemove,
  onZIndexShift,
}: ControlsProps) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Selected
          </div>
          <div className="text-sm truncate">
            {item?.name ?? "Piece"}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onZIndexShift("up")}
            aria-label="Bring forward"
            className="w-7 h-7 grid place-items-center rounded-full border border-border hover:border-rose"
          >
            <ChevronUp size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onZIndexShift("down")}
            aria-label="Send back"
            className="w-7 h-7 grid place-items-center rounded-full border border-border hover:border-rose"
          >
            <ChevronDown size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove from collage"
            className="w-7 h-7 grid place-items-center rounded-full border border-border hover:border-rose text-[#B53D2A]"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Scale</span>
          <span>{transform.scale.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min={0.3}
          max={2.5}
          step={0.05}
          value={transform.scale}
          onChange={(e) =>
            onTransformChange({ scale: Number.parseFloat(e.target.value) })
          }
          className="w-full accent-rose"
        />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Rotate</span>
          <span>{transform.rotation}°</span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={transform.rotation}
          onChange={(e) =>
            onTransformChange({ rotation: Number.parseInt(e.target.value, 10) })
          }
          className="w-full accent-rose"
        />
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
