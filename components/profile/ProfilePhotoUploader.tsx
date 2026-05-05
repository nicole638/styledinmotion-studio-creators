"use client";

import { useRef, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  value: string;
  onChange: (url: string) => void;
  creatorId: string;
}

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — profile photos are small
const ACCEPTED = "image/jpeg,image/png,image/webp,image/heic";

export function ProfilePhotoUploader({ value, onChange, creatorId }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Photo must be under 5 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const safeExt = /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
      const random = Math.random().toString(36).slice(2, 10);
      const path = `${creatorId}/profile-${Date.now()}-${random}.${safeExt}`;

      const { error: upErr } = await supabase.storage
        .from("profile-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || `image/${safeExt}`,
        });

      if (upErr) {
        setError(`Upload failed: ${upErr.message}`);
        return;
      }

      const { data } = supabase.storage
        .from("profile-photos")
        .getPublicUrl(path);
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
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Profile"
            className="w-32 h-32 rounded-full object-cover border border-border bg-card"
          />
          <button
            type="button"
            onClick={handlePick}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 inline-flex items-center justify-center w-9 h-9 rounded-full bg-rose text-white shadow hover:opacity-90 disabled:opacity-60"
            aria-label="Replace photo"
          >
            <Upload size={14} strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={uploading}
            aria-label="Remove photo"
            className="absolute -top-1 -right-1 inline-flex items-center justify-center w-7 h-7 rounded-full bg-bg border border-border hover:border-rose disabled:opacity-60"
          >
            <X size={12} strokeWidth={2} />
          </button>
          {uploading ? (
            <div className="absolute inset-0 rounded-full bg-bg/70 backdrop-blur grid place-items-center text-xs">
              Uploading…
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePick}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-1 w-32 h-32 rounded-full border border-dashed border-border bg-card hover:border-rose transition-colors disabled:opacity-60"
        >
          <ImagePlus size={20} strokeWidth={1.5} className="text-rose" />
          <p className="text-xs text-muted">
            {uploading ? "Uploading…" : "Add photo"}
          </p>
        </button>
      )}

      {error ? (
        <p className="mt-2 text-xs text-[#B53D2A]">{error}</p>
      ) : null}
    </div>
  );
}
