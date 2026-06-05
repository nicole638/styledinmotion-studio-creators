"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { archiveStorefrontAction } from "@/lib/storefronts/actions";

export function ArchiveConfirm({
  storefrontId,
  storefrontName,
}: {
  storefrontId: string;
  storefrontName: string;
}) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canArchive = confirmText.trim().toLowerCase() === storefrontName.trim().toLowerCase();

  function onArchive() {
    setError(null);
    startTransition(async () => {
      const res = await archiveStorefrontAction(storefrontId);
      if (!res.ok) {
        setError(res.error ?? "Archive failed.");
        return;
      }
      router.push("/admin/storefronts");
    });
  }

  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <label className="block text-sm font-medium text-ink mb-2">
        Type <span className="font-mono">{storefrontName}</span> to confirm:
      </label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
        placeholder={storefrontName}
      />
      {error ? (
        <div className="mt-3 p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      ) : null}
      <div className="mt-5 flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-5 py-2.5 rounded-full border border-border text-ink hover:bg-bg/40"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onArchive}
          disabled={!canArchive || pending}
          className="px-5 py-2.5 rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:bg-red-300"
        >
          {pending ? "Archiving…" : "Archive storefront"}
        </button>
      </div>
    </div>
  );
}
