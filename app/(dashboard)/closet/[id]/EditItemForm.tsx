"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Archive, ArchiveRestore } from "lucide-react";
import {
  updateClosetItemAction,
  archiveClosetItemAction,
  refetchItemPhotoAction,
} from "@/lib/closet/mutations";
import type { ClosetItem } from "@/types/closet";

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

export function EditItemForm({ item }: { item: ClosetItem }) {
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

  return (
    <form onSubmit={handleSave} className="space-y-6 max-w-2xl">
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
          <button
            type="button"
            onClick={handleRefetch}
            disabled={isRefetching || !url.trim()}
            className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-full border border-border bg-bg text-sm hover:border-rose disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={14} strokeWidth={2} />
            {isRefetching ? "Re-fetching…" : "Re-fetch from URL"}
          </button>
          <FieldRow label="Photo URL">
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-2xl border border-border bg-bg px-3 py-2 text-xs font-mono outline-none focus:border-rose"
            />
          </FieldRow>
          <p className="text-xs text-muted">
            Re-fetch pulls a fresh photo via the merchant URL. To upload a
            new photo from your computer, paste a hosted image URL above —
            direct file upload ships in a follow-up.
          </p>
        </div>
      </div>

      <FieldRow label="Name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Brand">
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
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
