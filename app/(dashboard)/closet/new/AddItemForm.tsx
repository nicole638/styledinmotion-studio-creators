"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  scrapeUrlAction,
  addClosetItemAction,
  bulkScrapeAction,
  bulkAddClosetItemsAction,
  type AddItemDraft,
  type BulkScrapeRow,
} from "@/lib/closet/mutations";

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

type Mode = "single" | "bulk";

export function AddItemForm() {
  const [mode, setMode] = useState<Mode>("single");

  return (
    <div>
      <div className="flex gap-1 mb-6">
        <button
          type="button"
          onClick={() => setMode("single")}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            mode === "single"
              ? "bg-rose text-white"
              : "bg-card border border-border hover:border-rose"
          }`}
        >
          Single URL
        </button>
        <button
          type="button"
          onClick={() => setMode("bulk")}
          className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
            mode === "bulk"
              ? "bg-rose text-white"
              : "bg-card border border-border hover:border-rose"
          }`}
        >
          Bulk paste
        </button>
      </div>

      {mode === "single" ? <SingleUrlForm /> : <BulkUrlForm />}
    </div>
  );
}

// ---------------------- Single ----------------------

function SingleUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [draft, setDraft] = useState<AddItemDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();
  const [isSaving, startSave] = useTransition();

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startFetch(async () => {
      const r = await scrapeUrlAction(url);
      if (r.ok && r.data) setDraft(r.data);
      else setError(r.error ?? "Could not fetch product info.");
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    startSave(async () => {
      const r = await addClosetItemAction(draft);
      if (r.ok) {
        router.push("/closet");
        router.refresh();
      } else {
        setError(r.error ?? "Could not save.");
      }
    });
  };

  if (!draft) {
    return (
      <form onSubmit={handleFetch} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
            Product URL
          </label>
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://amazon.com/... or https://reformation.com/..."
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
          />
          <p className="mt-1.5 text-xs text-muted">
            Paste a product link. We'll pull the photo, brand, and price.
          </p>
        </div>

        {error ? (
          <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isFetching || !url.trim()}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isFetching ? "Fetching…" : "Fetch product info"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-5 max-w-xl">
      <div className="bg-card border border-border rounded-2xl p-4 flex gap-4">
        {draft.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={draft.photoUrl}
            alt={draft.name || "Product"}
            className="w-24 h-32 object-cover rounded-xl bg-bg"
          />
        ) : (
          <div className="w-24 h-32 rounded-xl bg-bg grid place-items-center text-xs text-muted">
            No photo
          </div>
        )}
        <div className="flex-1 text-sm text-muted">
          Review the auto-filled details below. Edit anything that's wrong,
          then save.
        </div>
      </div>

      <FieldRow label="Name">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Brand">
          <input
            value={draft.brand}
            onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
        <FieldRow label="Price">
          <input
            value={draft.price}
            onChange={(e) => setDraft({ ...draft, price: e.target.value })}
            placeholder="e.g. 49.99"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Category">
          <select
            value={draft.category}
            onChange={(e) => setDraft({ ...draft, category: e.target.value })}
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
            value={draft.defaultWornSize}
            onChange={(e) =>
              setDraft({ ...draft, defaultWornSize: e.target.value })
            }
            placeholder="M, 8, 27 …"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
      </div>
      <FieldRow label="Product URL">
        <input
          value={draft.url}
          onChange={(e) => setDraft({ ...draft, url: e.target.value })}
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isSaving ? "Saving…" : "Save to closet"}
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(null);
            setError(null);
          }}
          className="text-sm text-muted hover:text-text"
        >
          Try a different URL
        </button>
      </div>
    </form>
  );
}

// ---------------------- Bulk ----------------------

function BulkUrlForm() {
  const router = useRouter();
  const [pasted, setPasted] = useState("");
  const [rows, setRows] = useState<BulkScrapeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();
  const [isSaving, startSave] = useTransition();

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const urls = pasted
      .split(/\r?\n/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urls.length === 0) {
      setError("Paste at least one URL.");
      return;
    }
    if (urls.length > 30) {
      setError("Max 30 URLs per batch — paste fewer.");
      return;
    }
    startFetch(async () => {
      const result = await bulkScrapeAction(urls);
      setRows(result);
    });
  };

  const handleSave = () => {
    if (!rows) return;
    const drafts = rows
      .filter((r) => r.ok && r.data)
      .map((r) => r.data as AddItemDraft);
    if (drafts.length === 0) {
      setError("No successfully fetched rows to save.");
      return;
    }
    setError(null);
    startSave(async () => {
      const r = await bulkAddClosetItemsAction(drafts);
      if (r.ok) {
        router.push("/closet");
        router.refresh();
      } else {
        setError(r.error ?? "Could not save.");
      }
    });
  };

  if (!rows) {
    return (
      <form onSubmit={handleFetch} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
            Paste URLs (one per line)
          </label>
          <textarea
            rows={10}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={"https://amazon.com/...\nhttps://reformation.com/...\nhttps://aloyoga.com/..."}
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-mono outline-none focus:border-rose"
          />
          <p className="mt-1.5 text-xs text-muted">
            Up to 30 URLs at a time. We fetch them in parallel — typically
            takes 5-15 seconds total.
          </p>
        </div>

        {error ? (
          <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={isFetching}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isFetching ? "Fetching…" : "Fetch all"}
        </button>
      </form>
    );
  }

  const okCount = rows.filter((r) => r.ok).length;
  const failCount = rows.length - okCount;

  return (
    <div className="max-w-3xl space-y-4">
      <div className="text-sm text-muted">
        Fetched <span className="text-text font-medium">{okCount}</span> of{" "}
        {rows.length} URLs successfully.
        {failCount > 0 ? (
          <>
            {" "}
            <span className="text-[#B53D2A]">{failCount} failed</span> — those
            won't be saved.
          </>
        ) : null}
      </div>

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li
            key={i}
            className={`rounded-2xl border p-3 flex gap-3 items-start text-sm ${
              r.ok ? "border-border bg-card" : "border-[#F4C7BF] bg-[#FBE9E5]"
            }`}
          >
            {r.ok && r.data?.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={r.data.photoUrl}
                alt=""
                className="w-12 h-16 object-cover rounded-lg bg-bg shrink-0"
              />
            ) : (
              <div className="w-12 h-16 rounded-lg bg-bg shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {r.ok ? (
                <>
                  <div className="font-medium truncate">
                    {r.data?.name || "Untitled"}
                  </div>
                  <div className="text-xs text-muted truncate">
                    {r.data?.brand ?? "—"} · {r.data?.price ?? "—"}
                  </div>
                </>
              ) : (
                <>
                  <div className="font-medium text-[#B53D2A]">
                    Couldn't fetch
                  </div>
                  <div className="text-xs text-muted truncate">{r.error}</div>
                </>
              )}
              <div className="text-[11px] text-muted mt-1 truncate">
                {r.url}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || okCount === 0}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isSaving ? "Saving…" : `Save ${okCount} pieces to closet`}
        </button>
        <button
          type="button"
          onClick={() => {
            setRows(null);
            setError(null);
          }}
          className="text-sm text-muted hover:text-text"
        >
          Start over
        </button>
      </div>
    </div>
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
