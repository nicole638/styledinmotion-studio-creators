"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Send, Save, RotateCcw } from "lucide-react";
import { CollageCanvas } from "./CollageCanvas";
import {
  CANVAS_SIZE,
  type CollageItemTransform,
  type CollageLayout,
  type TemplateId,
  TEMPLATE_OPTIONS,
} from "@/types/collage";
import { applyTemplate } from "@/lib/collage/templates";
import { renderCollageToPng } from "@/lib/collage/render";
import { saveCollageAction } from "@/lib/collage/mutations";
import type { ClosetItem } from "@/types/closet";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** Auth.uid() — used as storage path prefix for the flattened PNG */
  creatorId: string;
  /** Cutout-ready closet items only (cutout_photo_url IS NOT NULL) */
  cutoutItems: ClosetItem[];
}

const MAX_PIECES = 8;

export function CollageEditor({ creatorId, cutoutItems }: Props) {
  const router = useRouter();
  const itemsById = useMemo(() => {
    const m = new Map<string, ClosetItem>();
    for (const it of cutoutItems) m.set(it.id, it);
    return m;
  }, [cutoutItems]);

  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState<TemplateId>("editorial");
  const [items, setItems] = useState<CollageItemTransform[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"draft" | "publish" | null>(null);
  const [, startTransition] = useTransition();

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

  const selectedIds = useMemo(
    () => new Set(items.map((it) => it.itemId)),
    [items],
  );

  const handlePickerToggle = (item: ClosetItem) => {
    if (selectedIds.has(item.id)) {
      setItems((prev) => prev.filter((it) => it.itemId !== item.id));
      if (selectedId === item.id) setSelectedId(null);
      return;
    }
    if (items.length >= MAX_PIECES) return;
    // Append using current template's next-position rule
    const allIds = [...items.map((it) => it.itemId), item.id];
    const layout = applyTemplate(template, allIds);
    setItems(layout);
    setSelectedId(item.id);
  };

  const handleApplyTemplate = (next: TemplateId) => {
    setTemplate(next);
    setItems(applyTemplate(next, items.map((it) => it.itemId)));
  };

  const handleResetPositions = () => {
    setItems(applyTemplate(template, items.map((it) => it.itemId)));
  };

  const handleTransformChange = (
    id: string,
    next: Partial<CollageItemTransform>,
  ) => {
    setItems((prev) =>
      prev.map((it) => (it.itemId === id ? { ...it, ...next } : it)),
    );
  };

  const handleRemove = (id: string) => {
    setItems((prev) => prev.filter((it) => it.itemId !== id));
  };

  const handleZIndexShift = (id: string, direction: "up" | "down") => {
    setItems((prev) => {
      const sorted = [...prev].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((it) => it.itemId === id);
      if (idx < 0) return prev;
      const target = direction === "up" ? idx + 1 : idx - 1;
      if (target < 0 || target >= sorted.length) return prev;
      [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
      // Re-number z-indexes 0..n
      return sorted.map((it, i) => ({ ...it, zIndex: i }));
    });
  };

  const handleSave = (publish: boolean) => {
    if (items.length === 0) {
      setError("Add at least one piece to the collage.");
      return;
    }
    setError(null);
    setBusy(publish ? "publish" : "draft");
    startTransition(async () => {
      try {
        // 1. Render to PNG client-side
        const inputs = items.map((tr) => {
          const ci = itemsById.get(tr.itemId);
          return {
            itemId: tr.itemId,
            imageUrl: ci?.photoUrl ?? "",
            transform: tr,
          };
        });
        const blob = await renderCollageToPng(inputs);

        // 2. Upload to look-photos bucket via authenticated session
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

        // 3. Persist look + look_items via server action
        const layout: CollageLayout = { template, items };
        const r = await saveCollageAction({
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
        router.push(publish ? `/looks/${r.lookId}` : "/looks?view=draft");
        router.refresh();
      } catch (e: any) {
        setBusy(null);
        setError(
          e?.message ?? "Something went wrong rendering the collage.",
        );
      }
    });
  };

  const isBusy = busy !== null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 items-start">
      {/* Left: canvas + controls */}
      <div>
        <CollageCanvas
          items={items}
          itemsById={itemsById}
          selectedId={selectedId}
          onSelectionChange={setSelectedId}
          onTransformChange={handleTransformChange}
          onRemove={handleRemove}
          onZIndexShift={handleZIndexShift}
        />
        <p className="mt-2 text-xs text-muted text-center">
          Canvas is 1080×1080 — saved at full resolution.
        </p>
      </div>

      {/* Right: meta + template + picker */}
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

        {/* Template */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-muted">
              Template
            </div>
            <button
              type="button"
              onClick={handleResetPositions}
              disabled={items.length === 0}
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
                    ? "border-rose bg-rose/10"
                    : "border-border bg-card hover:border-rose"
                }`}
              >
                <div className="text-sm font-medium">{opt.label}</div>
                <div className="mt-1 text-xs text-muted leading-snug">
                  {opt.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Picker */}
        <div>
          <div className="text-xs uppercase tracking-widest text-muted mb-2">
            Pieces ({items.length}/{MAX_PIECES})
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
                  const picked = selectedIds.has(item.id);
                  const atMax = items.length >= MAX_PIECES && !picked;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => handlePickerToggle(item)}
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

        {/* Save buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={isBusy || items.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            <Send size={14} strokeWidth={2} />
            {busy === "publish" ? "Publishing…" : "Publish collage"}
          </button>
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isBusy || items.length === 0}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm hover:border-rose disabled:opacity-60 transition-colors"
          >
            <Save size={14} strokeWidth={2} />
            {busy === "draft" ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
