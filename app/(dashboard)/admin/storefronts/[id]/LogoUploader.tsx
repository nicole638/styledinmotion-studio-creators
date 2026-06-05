"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Upload } from "lucide-react";
import { uploadStorefrontLogoAction } from "@/lib/storefronts/actions";

export function LogoUploader({
  storefrontId,
  currentLogoUrl,
}: {
  storefrontId: string;
  currentLogoUrl: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentLogoUrl);

  function onPick() {
    inputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const fd = new FormData();
    fd.append("logo", file);

    startTransition(async () => {
      const res = await uploadStorefrontLogoAction(storefrontId, fd);
      if (!res.ok || !res.logoUrl) {
        setError(res.error ?? "Upload failed.");
        return;
      }
      setPreviewUrl(res.logoUrl);
      router.refresh();
    });
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <div className="flex items-center gap-5">
        {previewUrl ? (
          <Image
            src={previewUrl}
            alt="Brand logo"
            width={88}
            height={88}
            className="rounded-full object-cover"
            unoptimized
          />
        ) : (
          <div className="w-[88px] h-[88px] rounded-full bg-bg-alt border border-border flex items-center justify-center text-muted text-xl">
            ?
          </div>
        )}
        <div className="flex-1">
          <p className="text-sm text-ink font-medium">Brand mark</p>
          <p className="text-xs text-muted mt-0.5 max-w-md">
            JPEG, PNG, or WebP. Recommended 1000×1000 square. Replaces the
            object at <span className="font-mono">profile-photos/&lt;creator_id&gt;/profile.jpg</span>{" "}
            and updates both brand_storefronts.logo_url and
            creator_profiles.photo_url in one go.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={onFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={onPick}
          disabled={pending}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border text-sm hover:bg-bg/40 disabled:opacity-50"
        >
          <Upload size={14} />
          {pending ? "Uploading…" : currentLogoUrl ? "Replace logo" : "Upload logo"}
        </button>
      </div>
      {error ? (
        <div className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      ) : null}
    </div>
  );
}
