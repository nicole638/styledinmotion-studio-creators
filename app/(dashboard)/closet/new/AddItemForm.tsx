"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  quickAddItemPendingAction,
  bulkQuickAddItemsPendingAction,
} from "@/lib/closet/mutations";
import { CampaignMatchBanner } from "@/components/closet/CampaignMatchBanner";

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

// ─── Single ──────────────────────────────────────────────────────────────

function SingleUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startAdd(async () => {
      const r = await quickAddItemPendingAction(url);
      if (r.ok) {
        // Push to closet — the new item appears immediately as a "Fetching…"
        // card and populates via Realtime when the EF finishes.
        router.push("/closet");
        router.refresh();
      } else {
        setError(r.error ?? "Couldn't add — try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
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
          Paste a product link. We'll pull the photo, brand, and price in the
          background — usually under 10 seconds. You can keep adding while it
          works.
        </p>
      </div>

      <CampaignMatchBanner url={url} />

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isAdding || !url.trim()}
        className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {isAdding ? "Adding…" : "Add to closet"}
      </button>
    </form>
  );
}

// ─── Bulk ────────────────────────────────────────────────────────────────

function BulkUrlForm() {
  const router = useRouter();
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isAdding, startAdd] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
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
    startAdd(async () => {
      const r = await bulkQuickAddItemsPendingAction(urls);
      if (r.ok) {
        router.push("/closet");
        router.refresh();
      } else {
        setError(r.error ?? "Couldn't add — try again.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
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
          Up to 30 URLs at a time. Each one is fetched in parallel and shows
          up as a "Fetching…" card in your closet — you don't have to wait
          here.
        </p>
      </div>

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={isAdding}
        className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
      >
        {isAdding ? "Adding…" : "Add all to closet"}
      </button>
    </form>
  );
}
