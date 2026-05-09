"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw,
  Archive,
  ArchiveRestore,
  Crop,
  Trash2,
  Upload,
} from "lucide-react";
import {
  updateClosetItemAction,
  archiveClosetItemAction,
  refetchItemPhotoAction,
  applyEditedPhotoAction,
  deleteClosetItemAction,
} from "@/lib/closet/mutations";
import type { ClosetItem } from "@/types/closet";
import { PhotoFrameEditor } from "@/components/closet/PhotoFrameEditor";
import { renderCroppedPhoto } from "@/lib/closet/photo-edit";
import { createClient } from "@/lib/supabase/client";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME = ["image/png", "image/jpeg", "image/webp"];

const CATEGORIES = [
  "Top",
  "Pants",
  "Dress",
  "Shoes",
  "Bag",
  "Jewelry",
  "Accessory",
  "Outerwear",
  "Other",
];

export function EditItemForm({
  item,
  brandSuggestions = [],
}: {
  item: ClosetItem;
  /** Distinct brands the creator has used before — powers the autocomplete. */
  brandSuggestions?: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(item.name ?? "");
  const [brand, setBrand] = useState(item.brand ?? "");
  const [price, setPrice] = useState(item.price ?? "");
  const [category, setCategory] = useState(item.category ?? "");
  const [url, setUrl] = useState(item.url ?? "");
  const [defaultWornSize, setDefaultWornSize] = useState(
    item.defaultWornSize ?? "",
  );
  const [photoUrl, setPhotoUrl] = useState(item.photoUrl ?? "");

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, startSave] = useTransition();
  const [isRefetching, startRefetch] = useTransition();
  const [isArchiving, startArchive] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [editingPhoto, setEditingPhoto] = useState(false);
  const [applyingCrop, setApplyingCrop] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Replace the item's source photo with a file the creator uploads from
   * their device. Use case: merchant photo shows a full outfit (top + bottom)
   * and Photoroom can't reliably isolate just the top — creator drops in a
   * clean product-only image instead. Bypasses scrape + cutout pipeline.
   */
  const handleUploadFile = async (file: File) => {
    setError(null);
    setNotice(null);

    if (!ACCEPTED_MIME.includes(file.type)) {
      setError("Image must be PNG, JPEG, or WebP.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError(
        `Image is ${(file.size / 1024 / 1024).toFixed(1)}MB — keep it under 10MB.`,
      );
      return;
    }

    setUploadingPhoto(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const ext = file.type.includes("png")
        ? "png"
        : file.type.includes("webp")
        ? "webp"
        : "jpg";
      const random = Math.random().toString(36).slice(2, 10);
      const path = `${user.id}/${item.id}-upload-${Date.now()}-${random}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("item-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const { data: urlData } = supabase.storage
        .from("item-photos")
        .getPublicUrl(path);

      const r = await applyEditedPhotoAction(item.id, urlData.publicUrl);
      if (!r.ok) throw new Error(r.error ?? "Could not save uploaded photo.");

      setPhotoUrl(urlData.publicUrl);
      setNotice("Photo replaced.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not upload.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleApplyCrop = async (
    transform: import("@/lib/closet/photo-edit").PhotoTransform,
  ) => {
    if (!photoUrl) return;
    setApplyingCrop(true);
    setError(null);
    setNotice(null);
    try {
      const blob = await renderCroppedPhoto(photoUrl, transform);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in.");

      const random = Math.random().toString(36).slice(2, 10);
      const path = `${user.id}/${item.id}-${Date.now()}-${random}.png`;
      const { error: upErr } = await supabase.storage
        .from("item-photos")
        .upload(path, blob, {
          cacheControl: "3600",
          upsert: false,
          contentType: "image/png",
        });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

      const { data: urlData } = supabase.storage
        .from("item-photos")
        .getPublicUrl(path);

      const r = await applyEditedPhotoAction(item.id, urlData.publicUrl);
      if (!r.ok) throw new Error(r.error ?? "Could not save crop.");

      setPhotoUrl(urlData.publicUrl);
      setEditingPhoto(false);
      setNotice("Photo updated.");
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Could not apply crop.");
    } finally {
      setApplyingCrop(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    startSave(async () => {
      const r = await updateClosetItemAction({
        id: item.id,
        name,
        brand,
        price,
        category,
        url,
        defaultWornSize,
        photoUrl,
      });
      if (r.ok) setNotice("Saved.");
      else setError(r.error ?? "Could not save.");
    });
  };

  const handleRefetch = () => {
    setError(null);
    setNotice(null);
    startRefetch(async () => {
      const r = await refetchItemPhotoAction(item.id, url);
      if (r.ok) {
        setNotice("Photo re-fetched.");
        router.refresh();
      } else {
        setError(r.error ?? "Could not re-fetch photo.");
      }
    });
  };

  const handleArchiveToggle = () => {
    setError(null);
    setNotice(null);
    startArchive(async () => {
      const r = await archiveClosetItemAction(item.id, !item.archived);
      if (r.ok) {
        router.push("/closet");
        router.refresh();
      } else {
        setError(r.error ?? "Could not update archive.");
      }
    });
  };

  const handleDelete = () => {
    setError(null);
    setNotice(null);
    startDelete(async () => {
      const r = await deleteClosetItemAction(item.id);
      if (r.ok) {
        router.push("/closet");
        router.refresh();
      } else {
        setConfirmingDelete(false);
        setError(r.error ?? "Could not delete.");
      }
    });
  };

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
      {editingPhoto && photoUrl ? (
        <PhotoFrameEditor
          imageUrl={photoUrl}
          busy={applyingCrop}
          onApply={handleApplyCrop}
          onCancel={() => setEditingPhoto(false)}
        />
      ) : (
        <div className="bg-card border border-border rounded-2xl p-4 flex gap-4">
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={photoUrl}
              alt={name || "Product"}
              className="w-32 h-40 object-cover rounded-xl bg-bg"
            />
          ) : (
            <div className="w-32 h-40 rounded-xl bg-bg grid place-items-center text-xs text-muted">
              No photo
            </div>
          )}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-rose/40 bg-rose/5 text-sm text-rose font-medium hover:bg-rose/10 hover:border-rose disabled:opacity-60 transition-colors"
              >
                <Upload size={14} strokeWidth={2} />
                {uploadingPhoto ? "Uploading…" : "Upload product photo"}
              </button>
              <button
                type="button"
                onClick={handleRefetch}
                disabled={isRefetching || !url.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-bg text-sm hover:border-rose disabled:opacity-60 transition-colors"
              >
                <RefreshCw size={14} strokeWidth={2} />
                {isRefetching ? "Re-fetching…" : "Re-fetch from URL"}
              </button>
              <button
                type="button"
                onClick={() => setEditingPhoto(true)}
                disabled={!photoUrl}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-bg text-sm hover:border-rose disabled:opacity-60 transition-colors"
              >
                <Crop size={14} strokeWidth={2} />
                Crop & reposition
              </button>
            </div>

            {/* Hidden file input for the Upload button. Resets value after
                each pick so selecting the same file twice still fires onChange. */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadFile(f);
                e.target.value = "";
              }}
            />

            <FieldRow label="Photo URL">
              <input
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-2xl border border-border bg-bg px-3 py-2 text-xs font-mono outline-none focus:border-rose"
              />
            </FieldRow>
            <p className="text-xs text-muted leading-relaxed">
              <span className="text-text">Upload product photo</span> when the
              merchant photo shows a full outfit and you only want this piece
              visible — drop in a clean, single-garment image.{" "}
              <span className="text-text">Re-fetch</span> pulls a fresh photo
              via the merchant URL.{" "}
              <span className="text-text">Crop &amp; reposition</span> reframes
              the existing photo. PNG/JPEG/WebP, up to 10MB.
            </p>
          </div>
        </div>
      )}

      <FieldRow label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Brand">
          {/* Datalist gives us a native typeahead: creators get suggestions
              from brands they've used before, but freetext is still allowed.
              No JS required — browser handles match/filter. */}
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            list="creator-brand-suggestions"
            autoComplete="off"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
          {brandSuggestions.length > 0 ? (
            <datalist id="creator-brand-suggestions">
              {brandSuggestions.map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          ) : null}
        </FieldRow>
        <FieldRow label="Price">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="49.99"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          >
            <option value="">— select —</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Your usual size">
          <input
            value={defaultWornSize}
            onChange={(e) => setDefaultWornSize(e.target.value)}
            placeholder="M, 8, 27 …"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
      </div>

      <FieldRow label="Product URL">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className="text-sm text-text bg-card border border-border rounded-2xl px-4 py-3">
          {notice}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-border">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>

        <button
          type="button"
          onClick={handleArchiveToggle}
          disabled={isArchiving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-card text-sm hover:border-rose disabled:opacity-60 transition-colors"
        >
          {item.archived ? (
            <>
              <ArchiveRestore size={14} strokeWidth={2} />
              Unarchive
            </>
          ) : (
            <>
              <Archive size={14} strokeWidth={2} />
              Archive
            </>
          )}
        </button>

        {/* Permanent delete — destructive, requires confirmation. Refuses
            if the item is referenced by any look_items rows; UI surfaces
            that error and points the user toward Archive instead. */}
        {!confirmingDelete ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setNotice(null);
              setConfirmingDelete(true);
            }}
            disabled={isDeleting}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#F4C7BF] bg-[#FBE9E5] text-[#B53D2A] text-sm hover:border-[#B53D2A] disabled:opacity-60 transition-colors ml-auto"
          >
            <Trash2 size={14} strokeWidth={2} />
            Delete
          </button>
        ) : (
          <div className="ml-auto flex items-center gap-2 rounded-full border border-[#F4C7BF] bg-[#FBE9E5] px-3 py-1.5">
            <span className="text-xs text-[#B53D2A] font-medium">
              Delete forever?
            </span>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#B53D2A] text-white text-xs font-medium hover:opacity-90 disabled:opacity-60"
            >
              <Trash2 size={11} strokeWidth={2.5} />
              {isDeleting ? "Deleting…" : "Yes, delete"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={isDeleting}
              className="text-xs text-[#B53D2A] px-2 py-1 hover:underline disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </form>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="block text-xs uppercase tracking-widest text-muted mb-1.5">
        {label}
      </div>
      {children}
    </label>
  );
}
