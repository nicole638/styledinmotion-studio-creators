"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Send,
  Save,
  RotateCcw,
  Type,
  ImagePlus,
} from "lucide-react";
import { CollageCanvas } from "./CollageCanvas";
import {
  CANVAS_SIZE,
  type CutoutLayer,
  type Layer,
  type PhotoLayer,
  type TemplateId,
  TEMPLATE_OPTIONS,
  getTemplateBackground,
  makeDefaultTextLayer,
  newLayerId,
  type CollageLayout,
} from "@/types/collage";
import {
  applyTemplate,
  applyTemplateToCutouts,
} from "@/lib/collage/templates";
import {
  applyLayoutToCutouts,
  type LayoutTemplate,
} from "@/lib/collage/layouts";
import { LayoutCarousel } from "./LayoutCarousel";
import { renderCollageToPng } from "@/lib/collage/render";
import { saveCollageAction } from "@/lib/collage/mutations";
import type { ClosetItem } from "@/types/closet";
import { createClient } from "@/lib/supabase/client";

interface InitialCollage {
  /** looks.id of the existing collage we're editing */
  lookId: string;
  /** Current title — pre-fills the title input */
  title: string;
  /** Rehydrated layout from looks.collage_layout JSONB */
  layout: CollageLayout;
  /** True when the look has no published_at — affects the action buttons */
  isDraft: boolean;
}

interface Props {
  /** Auth.uid() — used as storage path prefix for the flattened PNG */
  creatorId: string;
  /** Cutout-ready closet items only (cutout_photo_url IS NOT NULL) */
  cutoutItems: ClosetItem[];
  /**
   * Set when editing an existing collage look. Pre-loads title + layers +
   * background + template into editor state, and routes Save through
   * saveCollageAction with lookId so the same row is updated rather than
   * a new one inserted.
   */
  initial?: InitialCollage;
}

const MAX_LAYERS = 12;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export function CollageEditor({ creatorId, cutoutItems, initial }: Props) {
  const router = useRouter();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isEdit = initial !== undefined;

  const cutoutsById = useMemo(() => {
    const m = new Map<string, ClosetItem>();
    for (const it of cutoutItems) m.set(it.id, it);
    return m;
  }, [cutoutItems]);

  const [title, setTitle] = useState(initial?.title ?? "");
  const [template, setTemplate] = useState<TemplateId>(
    initial?.layout.template ?? "editorial",
  );
  const [background, setBackground] = useState(
    initial?.layout.background ??
      getTemplateBackground(initial?.layout.template ?? "editorial"),
  );
  // In edit mode treat the loaded background as manually-chosen so swapping
  // templates doesn't silently replace the creator's saved background color.
  const [bgManuallyChanged, setBgManuallyChanged] = useState(isEdit);
  const [layers, setLayers] = useState<Layer[]>(initial?.layout.layers ?? []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [, startTransition] = useTransition();

  // Phase 3 layout-discovery state. selectedLayoutId is just for highlighting
  // the active card — the actual positions live on the cutout layers themselves
  // and can be edited freely after selection. layoutSeed reshuffles the
  // algorithmic "Mix" variants without touching the curated templates.
  const [selectedLayoutId, setSelectedLayoutId] = useState<string | null>(null);
  const [layoutSeed, setLayoutSeed] = useState(0);

  const filteredCutouts = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    if (!q) return cutoutItems;
    return cutoutItems.filter((it) => {
      const hay = [it.name, it.brand, it.category]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [cutoutItems, pickerSearch]);

  const cutoutLayerByItemId = useMemo(() => {
    const m = new Map<string, CutoutLayer>();
    for (const l of layers) {
      if (l.kind === "cutout") m.set(l.itemId, l);
    }
    return m;
  }, [layers]);

  const nextZIndex = () =>
    layers.reduce((max, l) => Math.max(max, l.zIndex), -1) + 1;

  // ────────── Cutout picker ──────────

  const handleCutoutToggle = (item: ClosetItem) => {
    const existing = cutoutLayerByItemId.get(item.id);
    if (existing) {
      removeLayer(existing.id);
      // The current layout was sized for the previous item count, so its id
      // won't match any card in the carousel after this change. Clear it so
      // the highlight isn't misleading.
      setSelectedLayoutId(null);
      return;
    }
    if (layers.length >= MAX_LAYERS) return;
    // Add to existing layout via template positioning rules
    const cutoutIds = [
      ...layers.filter((l): l is CutoutLayer => l.kind === "cutout").map((l) => l.itemId),
      item.id,
    ];
    const positionedCutouts = applyTemplateToCutouts(template, cutoutIds);
    // Preserve other (photo + text) layers untouched
    const others = layers.filter((l) => l.kind !== "cutout");
    setLayers([...positionedCutouts, ...others]);
    setSelectedLayoutId(null);
    // Select the newly added cutout
    const added = positionedCutouts.find((c) => c.itemId === item.id);
    if (added) setSelectedId(added.id);
  };

  // ────────── Template ──────────

  const handleApplyTemplate = (next: TemplateId) => {
    setTemplate(next);
    setLayers((prev) => applyTemplate(next, prev));
    if (!bgManuallyChanged) setBackground(getTemplateBackground(next));
  };

  const handleResetPositions = () => {
    setLayers((prev) => applyTemplate(template, prev));
    setSelectedLayoutId(null);
  };

  // Phase 3 — apply a LayoutTemplate from the carousel to the current cutouts.
  // Photo and text layers are preserved untouched (creators position those
  // deliberately and shouldn't lose their work when changing layouts).
  const handleApplyLayout = (layout: LayoutTemplate) => {
    setLayers((prev) => {
      const cutouts = prev.filter((l): l is CutoutLayer => l.kind === "cutout");
      const others = prev.filter((l) => l.kind !== "cutout");
      const repositioned = applyLayoutToCutouts(layout, cutouts);
      return [...repositioned, ...others];
    });
    setSelectedLayoutId(layout.id);
  };

  const handleReshuffleLayouts = () => {
    setLayoutSeed((s) => s + 1);
    // If the current selection was algorithmic, drop it — reshuffling means
    // the previously-selected layout id no longer exists in the new set.
    if (selectedLayoutId?.startsWith("algo-")) setSelectedLayoutId(null);
  };

  // ────────── Layer ops ──────────

  const handleLayerChange = (id: string, next: Partial<Layer>) => {
    setLayers((prev) =>
      prev.map((l) => (l.id === id ? ({ ...l, ...next } as Layer) : l)),
    );
  };

  const removeLayer = (id: string) => {
    setLayers((prev) => prev.filter((l) => l.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleZIndexShift = (id: string, direction: "up" | "down") => {
    setLayers((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((l) => l.id === id);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx + 1 : idx - 1;
      if (target < 0 || target >= sorted.length) return prev;
      [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
      return sorted.map((l, i) => ({ ...l, zIndex: i }) as Layer);
    });
  };

  // ────────── Add text ──────────

  const handleAddText = () => {
    if (layers.length >= MAX_LAYERS) {
      setError("Maximum 12 layers per collage.");
      return;
    }
    const t = makeDefaultTextLayer(nextZIndex());
    setLayers((prev) => [...prev, t]);
    setSelectedId(t.id);
  };

  // ────────── Add photo ──────────

  const handlePickPhoto = () => photoInputRef.current?.click();

  const handlePhotoUpload = async (file: File) => {
    setError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setError("Photo must be under 10 MB.");
      return;
    }
    if (layers.length >= MAX_LAYERS) {
      setError("Maximum 12 layers per collage.");
      return;
    }
    setPhotoUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
      const random = Math.random().toString(36).slice(2, 10);
      const path = `${creatorId}/collage-photo-${Date.now()}-${random}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from("look-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || `image/${safeExt}`,
        });
      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        return;
      }
      const { data: urlData } = supabase.storage
        .from("look-photos")
        .getPublicUrl(path);

      const photo: PhotoLayer = {
        id: newLayerId(),
        kind: "photo",
        photoUrl: urlData.publicUrl,
        x: CANVAS_SIZE / 2,
        y: CANVAS_SIZE / 2,
        scale: 1,
        rotation: 0,
        zIndex: nextZIndex(),
      };
      setLayers((prev) => [...prev, photo]);
      setSelectedId(photo.id);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  };

  // ────────── Save ──────────

  const handleSave = (publish: boolean) => {
    if (layers.length === 0) {
      setError("Add at least one piece, photo, or text layer.");
      return;
    }
    setError(null);
    setBusy(publish ? "publish" : "draft");
    startTransition(async () => {
      try {
        // Build the cutout-URL map for the renderer
        const cutoutUrls = new Map<string, string>();
        for (const l of layers) {
          if (l.kind === "cutout") {
            const url = cutoutsById.get(l.itemId)?.photoUrl;
            if (url) cutoutUrls.set(l.itemId, url);
          }
        }

        const blob = await renderCollageToPng({
          layers,
          cutoutUrls,
          background,
        });

        // Upload flattened PNG to look-photos
        const supabase = createClient();
        const random = Math.random().toString(36).slice(2, 10);
        const path = `${creatorId}/collage-${Date.now()}-${random}.png`;
        const { error: upErr } = await supabase.storage
          .from("look-photos")
          .upload(path, blob, {
            contentType: "image/png",
            upsert: false,
          });
        if (upErr) {
          setError(`Upload failed: ${upErr.message}`);
          setBusy(null);
          return;
        }
        const { data: urlData } = supabase.storage
          .from("look-photos")
          .getPublicUrl(path);

        const layout: CollageLayout = {
          template,
          background,
          layers,
        };
        const r = await saveCollageAction({
          lookId: initial?.lookId,
          title,
          coverPhotoUrl: urlData.publicUrl,
          layout,
          publish,
        });
        setBusy(null);

        if (!r.ok) {
          setError(r.error ?? "Could not save collage.");
          return;
        }
        // Edit mode: go back to the look detail page so the creator sees
        // their changes applied. Create mode: keep the previous routing
        // (look detail on publish, drafts tab on save-draft).
        if (isEdit) {
          router.push(`/looks/${r.lookId}`);
        } else {
          router.push(publish ? `/looks/${r.lookId}` : "/looks?view=draft");
        }
        router.refresh();
      } catch (e: any) {
        setBusy(null);
        setError(e?.message ?? "Something went wrong rendering the collage.");
      }
    });
  };

  const isBusy = busy !== null;
  const cutoutCount = layers.filter((l) => l.kind === "cutout").length;

  return (
    // Fixed-width left column at 540px (canvas display size) so the layout
    // carousel — which uses `w-max` for its scroll track — doesn't widen
    // the column past the canvas and crush the right-side controls. The
    // create flow only escaped this because the carousel is hidden until
    // the first item is added; the edit flow opens with items present and
    // would otherwise smoosh the toolbox on first paint.
    <div className="grid grid-cols-1 xl:grid-cols-[540px_minmax(0,1fr)] gap-8 items-start">{/* xl: not lg: — the dashboard sidebar eats ~256px, so 1024-1280 viewports leave too little room for the 540px canvas plus the right rail (title + Add buttons + 2-col template grid + cutout picker + Save). Stack vertically until 1280px+. */}
      {/* Left: layout carousel + canvas + controls */}
      <div className="space-y-3 min-w-0">
        {cutoutCount > 0 && cutoutCount <= 6 ? (
          <LayoutCarousel
            itemCount={cutoutCount}
            selectedLayoutId={selectedLayoutId}
            onSelect={handleApplyLayout}
            seed={layoutSeed}
            onReshuffle={handleReshuffleLayouts}
          />
        ) : null}
        <CollageCanvas
          layers={layers}
          background={background}
          cutoutsById={cutoutsById}
          selectedId={selectedId}
          onSelectionChange={setSelectedId}
          onLayerChange={handleLayerChange}
          onRemove={removeLayer}
          onZIndexShift={handleZIndexShift}
        />
        <p className="text-xs text-muted text-center">
          Canvas is 1080×1080 — saved at full resolution.
        </p>
      </div>

      {/* Right: meta + add layers + picker + save */}
      <div className="space-y-6">
        {/* Title */}
        <label className="block">
          <div className="text-xs uppercase tracking-widest text-muted mb-1.5">
            Title
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Sunday Editorial"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </label>

        {/* Add to canvas */}
        <div>
          <div className="text-xs uppercase tracking-widest text-muted mb-2">
            Add to canvas
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleAddText}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:border-rose"
            >
              <Type size={14} strokeWidth={2} />
              Add text
            </button>
            <button
              type="button"
              onClick={handlePickPhoto}
              disabled={photoUploading}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm hover:border-rose disabled:opacity-60"
            >
              <ImagePlus size={14} strokeWidth={2} />
              {photoUploading ? "Uploading…" : "Add photo"}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handlePhotoUpload(f);
              }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            Photos can be whole-look shots — drag/scale to fill the canvas
            as a backdrop, then layer cutouts on top.
          </p>
        </div>

        {/* Template */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-muted">
              Template + background
            </div>
            <button
              type="button"
              onClick={handleResetPositions}
              disabled={layers.length === 0}
              className="inline-flex items-center gap-1 text-xs text-muted hover:text-text disabled:opacity-40"
            >
              <RotateCcw size={11} strokeWidth={2} />
              Reset positions
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleApplyTemplate(opt.id)}
                className={`text-left p-3 rounded-2xl border transition-colors ${
                  template === opt.id
                    ? "border-rose ring-2 ring-rose/20"
                    : "border-border hover:border-rose"
                }`}
                style={{ backgroundColor: opt.background }}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="mt-1 text-xs text-muted leading-snug">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-muted">
              Custom bg
            </span>
            <input
              type="color"
              value={background}
              onChange={(e) => {
                setBackground(e.target.value);
                setBgManuallyChanged(true);
              }}
              aria-label="Custom background color"
              className="w-7 h-7 rounded-full border border-border cursor-pointer"
            />
            {bgManuallyChanged ? (
              <button
                type="button"
                onClick={() => {
                  setBackground(getTemplateBackground(template));
                  setBgManuallyChanged(false);
                }}
                className="text-xs text-muted hover:text-text underline underline-offset-2"
              >
                Reset to template
              </button>
            ) : null}
          </div>
        </div>

        {/* Cutout picker */}
        <div>
          <div className="text-xs uppercase tracking-widest text-muted mb-2">
            Closet pieces ({layers.filter((l) => l.kind === "cutout").length}/
            {MAX_LAYERS})
          </div>
          {cutoutItems.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center">
              <p className="text-sm text-muted">
                No cutout-ready pieces in your closet. Run the cutout
                generator on the iOS app first, then come back to compose.
              </p>
            </div>
          ) : (
            <>
              <div className="relative mb-3">
                <Search
                  size={14}
                  strokeWidth={2}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search cutouts"
                  className="w-full rounded-full border border-border bg-card pl-9 pr-3 py-2 text-sm outline-none focus:border-rose"
                />
              </div>
              <ul className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-[420px] overflow-y-auto">
                {filteredCutouts.map((item) => {
                  const picked = cutoutLayerByItemId.has(item.id);
                  const atMax = layers.length >= MAX_LAYERS && !picked;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handleCutoutToggle(item)}
                        disabled={atMax}
                        className={`group block w-full rounded-xl border overflow-hidden transition-colors disabled:opacity-40 ${
                          picked
                            ? "border-rose ring-2 ring-rose/30"
                            : "border-border bg-card hover:border-rose"
                        }`}
                      >
                        <div className="relative aspect-square bg-bg">
                          {item.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.photoUrl}
                              alt={item.name ?? "Piece"}
                              className="absolute inset-0 w-full h-full object-contain p-2"
                            />
                          ) : null}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {/* Error */}
        {error ? (
          <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
            {error}
          </div>
        ) : null}

        {/* Save */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
          {isEdit ? (
            <>
              {/* Edit mode — preserve published/draft state on primary save.
                  Was-published collage: primary = "Save changes" (stays published).
                  Was-draft collage:     primary = "Publish collage", secondary keeps as draft. */}
              {initial!.isDraft ? (
                <>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    disabled={isBusy || layers.length === 0}
                    className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                  >
                    <Send size={14} strokeWidth={2} />
                    {busy === "publish" ? "Publishing…" : "Publish collage"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(false)}
                    disabled={isBusy || layers.length === 0}
                    className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm hover:border-rose disabled:opacity-60 transition-colors"
                  >
                    <Save size={14} strokeWidth={2} />
                    {busy === "draft" ? "Saving…" : "Save draft"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSave(true)}
                  disabled={isBusy || layers.length === 0}
                  className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
                >
                  <Save size={14} strokeWidth={2} />
                  {busy === "publish" ? "Saving…" : "Save changes"}
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => handleSave(true)}
                disabled={isBusy || layers.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
              >
                <Send size={14} strokeWidth={2} />
                {busy === "publish" ? "Publishing…" : "Publish collage"}
              </button>
              <button
                type="button"
                onClick={() => handleSave(false)}
                disabled={isBusy || layers.length === 0}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm hover:border-rose disabled:opacity-60 transition-colors"
              >
                <Save size={14} strokeWidth={2} />
                {busy === "draft" ? "Saving…" : "Save draft"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
