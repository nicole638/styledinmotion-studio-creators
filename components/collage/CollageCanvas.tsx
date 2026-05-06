"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  ChevronDown,
  Trash2,
  Bold,
  Italic,
} from "lucide-react";
import {
  CANVAS_SIZE,
  DISPLAY_SIZE,
  DISPLAY_SCALE,
  TEXT_COLOR_PRESETS,
  type Layer,
  type TextLayer,
} from "@/types/collage";
import { CUTOUT_BASE_SIZE, PHOTO_LAYER_BASE_SIZE, fontFamilyToCss } from "@/lib/collage/render";
import type { ClosetItem } from "@/types/closet";

interface Props {
  layers: Layer[];
  background: string;
  /** Closet items keyed by id — used to look up cutout/photo URLs. */
  cutoutsById: Map<string, ClosetItem>;
  selectedId: string | null;
  onSelectionChange: (id: string | null) => void;
  onLayerChange: (id: string, next: Partial<Layer>) => void;
  onRemove: (id: string) => void;
  onZIndexShift: (id: string, direction: "up" | "down") => void;
}

export function CollageCanvas({
  layers,
  background,
  cutoutsById,
  selectedId,
  onSelectionChange,
  onLayerChange,
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

  // Cache image aspect ratios for cutouts + photos
  const [aspects, setAspects] = useState<Record<string, number>>({});

  useEffect(() => {
    layers.forEach((layer) => {
      if (layer.kind === "text") return;
      if (aspects[layer.id]) return;
      const url =
        layer.kind === "cutout"
          ? cutoutsById.get(layer.itemId)?.photoUrl
          : layer.photoUrl;
      if (!url) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        if (img.naturalWidth && img.naturalHeight) {
          setAspects((prev) => ({
            ...prev,
            [layer.id]: img.naturalWidth / img.naturalHeight,
          }));
        }
      };
      img.src = url;
    });
  }, [layers, cutoutsById, aspects]);

  const handlePointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    onSelectionChange(id);
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    dragRef.current = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
    };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = (e.clientX - dragRef.current.startX) / DISPLAY_SCALE;
    const dy = (e.clientY - dragRef.current.startY) / DISPLAY_SCALE;
    onLayerChange(dragRef.current.id, {
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
    if (e.target === canvasRef.current) onSelectionChange(null);
  };

  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="relative mx-auto rounded-2xl overflow-hidden border border-border shadow-sm"
        style={{
          width: DISPLAY_SIZE,
          height: DISPLAY_SIZE,
          backgroundColor: background,
        }}
      >
        {layers.map((layer) => {
          const isSelected = selectedId === layer.id;

          if (layer.kind === "text") {
            return (
              <TextLayerEl
                key={layer.id}
                layer={layer}
                isSelected={isSelected}
                onPointerDown={(e) => handlePointerDown(e, layer.id)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              />
            );
          }

          // Cutout or photo
          const url =
            layer.kind === "cutout"
              ? cutoutsById.get(layer.itemId)?.photoUrl
              : layer.photoUrl;
          if (!url) return null;

          const aspect = aspects[layer.id] ?? 1;
          const baseSize =
            layer.kind === "cutout" ? CUTOUT_BASE_SIZE : PHOTO_LAYER_BASE_SIZE;
          const baseDisplay = baseSize * DISPLAY_SCALE;
          let w = baseDisplay;
          let h = baseDisplay;
          if (aspect >= 1) h = baseDisplay / aspect;
          else w = baseDisplay * aspect;
          w *= layer.scale;
          h *= layer.scale;

          const left = layer.x * DISPLAY_SCALE - w / 2;
          const top = layer.y * DISPLAY_SCALE - h / 2;

          return (
            <div
              key={layer.id}
              onPointerDown={(e) => handlePointerDown(e, layer.id)}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className={`absolute cursor-move touch-none select-none ${
                isSelected
                  ? "ring-2 ring-rose ring-offset-2 ring-offset-bg"
                  : ""
              }`}
              style={{
                left,
                top,
                width: w,
                height: h,
                transform: `rotate(${layer.rotation}deg)`,
                zIndex: layer.zIndex,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={
                  layer.kind === "cutout"
                    ? cutoutsById.get(layer.itemId)?.name ?? "Piece"
                    : "Photo"
                }
                draggable={false}
                crossOrigin="anonymous"
                className={`w-full h-full pointer-events-none ${
                  layer.kind === "cutout" ? "object-contain" : "object-cover"
                }`}
              />
            </div>
          );
        })}
      </div>

      {selectedLayer ? (
        <SelectedLayerControls
          layer={selectedLayer}
          cutoutName={
            selectedLayer.kind === "cutout"
              ? cutoutsById.get(selectedLayer.itemId)?.name ?? undefined
              : undefined
          }
          onLayerChange={(next) => onLayerChange(selectedLayer.id, next)}
          onRemove={() => {
            onRemove(selectedLayer.id);
            onSelectionChange(null);
          }}
          onZIndexShift={(direction) => onZIndexShift(selectedLayer.id, direction)}
        />
      ) : (
        <p className="text-xs text-muted text-center">
          Tap a layer to select. Drag to move, use sliders below to scale and rotate.
        </p>
      )}
    </div>
  );
}

// ─────────── Text layer ───────────

function TextLayerEl({
  layer,
  isSelected,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  layer: TextLayer;
  isSelected: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
}) {
  // Display scale: 1080-space sizes scaled to display
  const fontSizePx = layer.fontSize * DISPLAY_SCALE * layer.scale;
  const left = layer.x * DISPLAY_SCALE;
  const top = layer.y * DISPLAY_SCALE;

  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={`absolute cursor-move touch-none select-none px-2 py-1 ${
        isSelected ? "outline outline-2 outline-rose outline-offset-2" : ""
      }`}
      style={{
        left,
        top,
        transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
        zIndex: layer.zIndex,
        fontFamily: fontFamilyToCss(layer.fontFamily),
        fontSize: fontSizePx,
        fontWeight: layer.bold ? 700 : 400,
        fontStyle: layer.italic ? "italic" : "normal",
        color: layer.color,
        whiteSpace: "pre",
        lineHeight: 1.2,
        textAlign: "center",
      }}
    >
      {layer.text || " "}
    </div>
  );
}

// ─────────── Controls ───────────

interface ControlsProps {
  layer: Layer;
  cutoutName?: string;
  onLayerChange: (next: Partial<Layer>) => void;
  onRemove: () => void;
  onZIndexShift: (direction: "up" | "down") => void;
}

function SelectedLayerControls({
  layer,
  cutoutName,
  onLayerChange,
  onRemove,
  onZIndexShift,
}: ControlsProps) {
  const kindLabel =
    layer.kind === "cutout"
      ? cutoutName ?? "Piece"
      : layer.kind === "photo"
        ? "Photo"
        : "Text";
  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-muted">
            Selected · {layer.kind}
          </div>
          <div className="text-sm truncate">{kindLabel}</div>
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
            aria-label="Remove layer"
            className="w-7 h-7 grid place-items-center rounded-full border border-border hover:border-rose text-[#B53D2A]"
          >
            <Trash2 size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      {layer.kind === "text" ? (
        <TextControls layer={layer} onLayerChange={onLayerChange} />
      ) : null}

      <div>
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Scale</span>
          <span>{layer.scale.toFixed(2)}×</span>
        </div>
        <input
          type="range"
          min={layer.kind === "text" ? 0.4 : 0.3}
          max={3.0}
          step={0.05}
          value={layer.scale}
          onChange={(e) =>
            onLayerChange({ scale: Number.parseFloat(e.target.value) })
          }
          className="w-full accent-rose"
        />
      </div>

      <div>
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Rotate</span>
          <span>{layer.rotation}°</span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={layer.rotation}
          onChange={(e) =>
            onLayerChange({ rotation: Number.parseInt(e.target.value, 10) })
          }
          className="w-full accent-rose"
        />
      </div>
    </div>
  );
}

function TextControls({
  layer,
  onLayerChange,
}: {
  layer: TextLayer;
  onLayerChange: (next: Partial<Layer>) => void;
}) {
  return (
    <div className="space-y-3 border-b border-border pb-3">
      <textarea
        value={layer.text}
        onChange={(e) => onLayerChange({ text: e.target.value })}
        rows={2}
        placeholder="Type your text"
        className="w-full rounded-2xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-rose resize-y"
      />

      <div>
        <div className="flex items-center justify-between text-xs text-muted mb-1">
          <span>Font size</span>
          <span>{layer.fontSize}px</span>
        </div>
        <input
          type="range"
          min={32}
          max={240}
          step={4}
          value={layer.fontSize}
          onChange={(e) =>
            onLayerChange({ fontSize: Number.parseInt(e.target.value, 10) })
          }
          className="w-full accent-rose"
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 text-xs">
          {(["display", "serif", "sans"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => onLayerChange({ fontFamily: f })}
              className={`px-2 py-1 rounded-md ${
                layer.fontFamily === f
                  ? "bg-rose text-white"
                  : "bg-bg border border-border"
              }`}
            >
              {f === "display" ? "Editorial" : f === "serif" ? "Serif" : "Sans"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onLayerChange({ bold: !layer.bold })}
            aria-label="Bold"
            className={`w-7 h-7 grid place-items-center rounded-md ${
              layer.bold ? "bg-rose text-white" : "bg-bg border border-border"
            }`}
          >
            <Bold size={12} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => onLayerChange({ italic: !layer.italic })}
            aria-label="Italic"
            className={`w-7 h-7 grid place-items-center rounded-md ${
              layer.italic ? "bg-rose text-white" : "bg-bg border border-border"
            }`}
          >
            <Italic size={12} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div>
        <div className="text-xs text-muted mb-1">Color</div>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLOR_PRESETS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => onLayerChange({ color })}
              aria-label={`Color ${color}`}
              className={`w-7 h-7 rounded-full border ${
                layer.color.toLowerCase() === color.toLowerCase()
                  ? "border-rose ring-2 ring-rose/30"
                  : "border-border"
              }`}
              style={{ backgroundColor: color }}
            />
          ))}
          <input
            type="color"
            value={layer.color}
            onChange={(e) => onLayerChange({ color: e.target.value })}
            aria-label="Custom color"
            className="w-7 h-7 rounded-full border border-border cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
