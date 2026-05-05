"use client";

import { useRef, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  /** Current cover photo URL (from look or "" before upload). */
  value: string;
  /** Called with the public URL after a successful upload, or "" on clear. */
  onChange: (url: string) => void;
  /** Used as the storage path prefix (auth.uid()). */
  creatorId: string;
}

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic";

export function CoverPhotoUploader({ value, onChange, creatorId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError("Photo must be under 8 MB.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
      const random = Math.random().toString(36).slice(2, 10);
      const path = `${creatorId}/${Date.now()}-${random}.${safeExt}`;

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

      const { data } = supabase.storage.from("look-photos").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {value ? (
        <div className="relative rounded-2xl overflow-hidden border border-border bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Look cover"
            className="block w-full max-h-[480px] object-cover"
          />
          <div className="absolute top-3 right-3 flex gap-2">
            <button
              type="button"
              onClick={handlePick}
              disabled={uploading}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-bg/90 backdrop-blur border border-border text-xs hover:border-rose disabled:opacity-60"
            >
              <Upload size={12} strokeWidth={2} />
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={uploading}
              aria-label="Remove cover"
              className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-bg/90 backdrop-blur border border-border hover:border-rose disabled:opacity-60"
            >
              <X size={12} strokeWidth={2} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-2 w-full aspect-[4/5] max-h-[480px] rounded-2xl border border-dashed border-border bg-card hover:border-rose transition-colors disabled:opacity-60"
        >
          <ImagePlus
            size={32}
            strokeWidth={1.5}
            className="text-rose"
          />
          <p className="text-sm font-medium">
            {uploading ? "Uploading…" : "Drop a cover photo"}
          </p>
          <p className="text-xs text-muted">JPG, PNG, WebP, or HEIC · up to 8 MB</p>
        </button>
      )}

      {error ? (
        <p className="mt-2 text-xs text-[#B53D2A]">{error}</p>
      ) : null}
    </div>
  );
}
