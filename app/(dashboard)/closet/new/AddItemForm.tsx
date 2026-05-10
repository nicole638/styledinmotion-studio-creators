"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, X, Sparkles, ExternalLink } from "lucide-react";
import {
  scrapeUrlAction,
  addClosetItemAction,
  bulkQuickAddItemsPendingAction,
  type AddItemDraft,
} from "@/lib/closet/mutations";
import { CampaignMatchBanner } from "@/components/closet/CampaignMatchBanner";
import { createClient } from "@/lib/supabase/client";
import { extractAsin } from "@/lib/closet/asin";
import type { Campaign } from "@/types/campaigns";

type Mode = "single" | "bulk";

const EMPTY_DRAFT: AddItemDraft = {
  name: "",
  brand: "",
  price: "",
  category: "",
  url: "",
  defaultWornSize: "",
  photoUrl: "",
  originalPhotoUrl: "",
};

/**
 * Top-level Add Item entry point. Two modes:
 *   - Single URL → preview-then-save: paste URL, fetch details, edit
 *     fields, save. Skips the async pending state since the user has
 *     already reviewed the data.
 *   - Bulk paste → async/queued: paste 1-30 URLs, each becomes a
 *     "Fetching…" card on /closet that fills in via Realtime as the
 *     scrape EF completes.
 */
export function AddItemForm({
  initialUrl = "",
  initialDraft,
}: {
  /** Prefill the URL field — used by the Active Campaigns widget on the
   *  dashboard so a campaign ASIN one-taps into the Add flow. When set,
   *  the form opens in single-URL mode regardless of which mode the user
   *  was last in. */
  initialUrl?: string;
  /** Fully-formed draft that lets us SKIP the URL stage entirely and
   *  land the creator on the editable review form. Used by the campaign-
   *  tile shortcut where we resolve the product server-side from
   *  amazon_product_cache + the campaign's per-ASIN URL. */
  initialDraft?: AddItemDraft;
}) {
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

      {mode === "single" ? (
        <SingleUrlForm
          initialUrl={initialUrl}
          initialDraft={initialDraft}
        />
      ) : (
        <BulkUrlForm />
      )}
    </div>
  );
}

// ─── Single URL: preview-then-save ───────────────────────────────────────
//
// State machine:
//   stage="url"    — initial form, user pastes a URL.
//                    Two paths out: Fetch details → "review", or
//                    Add manually → "review" with empty draft.
//   stage="review" — editable form pre-filled with whatever scrape
//                    returned (or empty if manual). User adjusts, then
//                    Save commits via addClosetItemAction with
//                    fetch_status=complete (skips async pending).

type SingleStage = "url" | "review";

function SingleUrlForm({
  initialUrl = "",
  initialDraft,
}: {
  initialUrl?: string;
  initialDraft?: AddItemDraft;
}) {
  const router = useRouter();
  // Skip the URL stage entirely when the server resolved a draft for us
  // (campaign-tile shortcut, or a cache-hit on the pasted URL's ASIN).
  const [stage, setStage] = useState<SingleStage>(
    initialDraft ? "review" : "url",
  );
  const [url, setUrl] = useState(initialDraft?.url ?? initialUrl);
  const [draft, setDraft] = useState<AddItemDraft>(
    initialDraft ?? EMPTY_DRAFT,
  );
  const [error, setError] = useState<string | null>(null);
  const [scrapeNotice, setScrapeNotice] = useState<string | null>(null);
  const [swapNotice, setSwapNotice] = useState<string | null>(null);
  const [isFetching, startFetch] = useTransition();
  const [isSaving, startSave] = useTransition();

  // When a pasted URL matches an active campaign AND we have the
  // campaign-specific share URL on file (campaignId + linkId + tag baked
  // in), auto-swap to it. The bare /dp/<asin> URL won't pay out — Amazon
  // Creator Connections needs the campaign-tagged URL verbatim.
  const handleCampaignMatch = useCallback(
    (campaign: Campaign) => {
      const asin = extractAsin(url);
      if (!asin) return;
      const campaignUrl = campaign.asinLinks?.[asin];
      if (!campaignUrl) return;
      if (campaignUrl === url.trim()) return; // already on it
      setUrl(campaignUrl);
      setSwapNotice(
        `Swapped to the ${campaign.brandName} campaign URL so commissions attribute.`,
      );
    },
    [url],
  );

  // Some URL params are critical for affiliate attribution and MUST be
  // preserved through the scrape step. The scraper's canonical_url strips
  // everything; we override with the user's pasted URL when these signals
  // are present.
  const hasAttributionParams = (raw: string): boolean =>
    /[?&](campaignId|linkId|ascsubtag|tag)=/i.test(raw);

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setScrapeNotice(null);
    startFetch(async () => {
      const r = await scrapeUrlAction(url);
      if (r.ok && r.data) {
        const userUrl = url.trim();
        const finalUrl = hasAttributionParams(userUrl) ? userUrl : r.data.url;
        setDraft({ ...r.data, url: finalUrl });
        // Mention partial pulls so creators know what's missing.
        const missing: string[] = [];
        if (!r.data.name) missing.push("name");
        if (!r.data.brand) missing.push("brand");
        if (!r.data.price) missing.push("price");
        if (!r.data.photoUrl) missing.push("photo");
        if (missing.length > 0) {
          setScrapeNotice(
            `We pulled what we could — fill in ${missing.join(", ")} below.`,
          );
        }
        setStage("review");
      } else {
        setError(r.error ?? "Couldn't fetch.");
      }
    });
  };

  const handleManual = () => {
    setError(null);
    setScrapeNotice(null);
    setDraft({ ...EMPTY_DRAFT, url: url.trim() });
    setStage("review");
  };

  const handleStartOver = () => {
    setStage("url");
    setError(null);
    setScrapeNotice(null);
    setSwapNotice(null);
    setDraft(EMPTY_DRAFT);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      const r = await addClosetItemAction(draft);
      if (r.ok) {
        router.push("/closet");
        router.refresh();
      } else {
        setError(r.error ?? "Couldn't save.");
      }
    });
  };

  if (stage === "review") {
    return (
      <ReviewForm
        draft={draft}
        onChange={setDraft}
        onSave={handleSave}
        onStartOver={handleStartOver}
        isSaving={isSaving}
        error={error}
        notice={scrapeNotice}
      />
    );
  }

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
          Paste a product link. We'll pull the photo, brand, and price so
          you can review before saving.
        </p>
      </div>

      <CampaignMatchBanner url={url} onMatch={handleCampaignMatch} />

      {swapNotice ? (
        <div
          role="status"
          className="text-xs text-text bg-card border border-border rounded-2xl px-4 py-2.5"
        >
          {swapNotice}
        </div>
      ) : null}

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3 space-y-2">
          <p>{error}</p>
          <div className="flex items-center gap-4 flex-wrap text-xs">
            {/* Open the URL in a new tab so the creator can verify it's
                the right product page before falling through to manual
                entry. Some merchants block the scraper but render fine
                in a normal browser. */}
            {/^https?:\/\//i.test(url.trim()) ? (
              <a
                href={url.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 underline underline-offset-2 hover:no-underline"
              >
                <ExternalLink size={11} strokeWidth={2.25} />
                Open product page
              </a>
            ) : null}
            <button
              type="button"
              onClick={handleManual}
              className="underline underline-offset-2 hover:no-underline"
            >
              Or add it manually instead →
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex gap-3 items-center flex-wrap">
        <button
          type="submit"
          disabled={isFetching || !url.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isFetching ? (
            <>
              <Loader2 size={14} strokeWidth={2.5} className="animate-spin" />
              Fetching…
            </>
          ) : (
            <>
              <Sparkles size={14} strokeWidth={2.25} />
              Fetch details
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handleManual}
          disabled={!url.trim() || isFetching}
          className="text-sm text-muted underline underline-offset-2 hover:text-rose disabled:opacity-50 transition-colors"
        >
          Or add manually
        </button>
      </div>
    </form>
  );
}

function ReviewForm({
  draft,
  onChange,
  onSave,
  onStartOver,
  isSaving,
  error,
  notice,
}: {
  draft: AddItemDraft;
  onChange: (d: AddItemDraft) => void;
  onSave: (e: React.FormEvent) => void;
  onStartOver: () => void;
  isSaving: boolean;
  error: string | null;
  notice: string | null;
}) {
  const set = (key: keyof AddItemDraft, value: string) =>
    onChange({ ...draft, [key]: value });

  const hasOpenableUrl = /^https?:\/\//i.test(draft.url.trim());

  return (
    <form onSubmit={onSave} className="space-y-4 max-w-xl">
      {/* Quick "Open product page" link at the top of the review form so
          creators can pop the merchant page in a new tab to grab price,
          category, size info, etc. without losing the form's state. */}
      {hasOpenableUrl ? (
        <a
          href={draft.url.trim()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-rose hover:underline"
        >
          <ExternalLink size={12} strokeWidth={2.25} />
          Open product page in new tab
        </a>
      ) : null}

      <PhotoField
        photoUrl={draft.photoUrl}
        onChange={(url) =>
          onChange({
            ...draft,
            photoUrl: url,
            // Keep originalPhotoUrl pointing at the merchant's source so
            // a later "Re-fetch" on Edit can restore it.
            originalPhotoUrl: draft.originalPhotoUrl || url,
          })
        }
      />

      {notice ? (
        <div className="text-xs text-muted bg-card border border-border rounded-2xl px-4 py-2.5">
          {notice}
        </div>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          label="Name"
          value={draft.name}
          onChange={(v) => set("name", v)}
          required
          placeholder="Linen Midi Dress"
        />
        <Field
          label="Brand"
          value={draft.brand}
          onChange={(v) => set("brand", v)}
          placeholder="Reformation"
        />
        <Field
          label="Price"
          value={draft.price}
          onChange={(v) => set("price", v)}
          placeholder="$148"
        />
        <Field
          label="Category"
          value={draft.category}
          onChange={(v) => set("category", v)}
          placeholder="Dress, Top, Bottom…"
        />
        <Field
          label="Default size worn"
          value={draft.defaultWornSize}
          onChange={(v) => set("defaultWornSize", v)}
          placeholder="M, 6, etc."
        />
        <Field
          label="Product URL"
          value={draft.url}
          onChange={(v) => set("url", v)}
          type="url"
        />
      </div>

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <div className="flex gap-3 items-center pt-2">
        <button
          type="submit"
          disabled={isSaving || !draft.name.trim()}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {isSaving ? "Saving…" : "Add to closet"}
        </button>
        <button
          type="button"
          onClick={onStartOver}
          className="text-sm text-muted underline underline-offset-2 hover:text-rose transition-colors"
        >
          Start over
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
      />
    </div>
  );
}

/**
 * Photo upload + preview for a not-yet-saved item. Uploads to the
 * existing `item-photos` Supabase Storage bucket under the creator's
 * own id (RLS allows this prefix). The merchant CDN URL stays editable
 * via the photoUrl field but most creators will just upload or accept
 * what the scrape returned.
 */
function PhotoField({
  photoUrl,
  onChange,
}: {
  photoUrl: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = () => inputRef.current?.click();

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    setUploading(true);
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
      const path = `${user.id}/new-${Date.now()}-${random}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("item-photos")
        .upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });
      if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
      const { data } = supabase.storage.from("item-photos").getPublicUrl(path);
      onChange(data.publicUrl);
    } catch (e: any) {
      setError(e?.message ?? "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleClear = () => {
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex gap-4 items-start">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt="Product"
          className="w-24 h-32 object-cover rounded-xl bg-bg shrink-0 border border-border"
        />
      ) : (
        <div className="w-24 h-32 rounded-xl border border-dashed border-border bg-bg grid place-items-center shrink-0">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            No photo
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">
          Product photo
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handlePick}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-xs hover:border-rose disabled:opacity-60 transition-colors"
          >
            <Upload size={12} strokeWidth={2.25} />
            {uploading
              ? "Uploading…"
              : photoUrl
                ? "Replace photo"
                : "Upload photo"}
          </button>
          {photoUrl ? (
            <button
              type="button"
              onClick={handleClear}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-xs hover:border-rose disabled:opacity-60 transition-colors"
            >
              <X size={12} strokeWidth={2.25} />
              Remove
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[11px] text-muted">
          JPG, PNG, or WebP. Up to 10 MB.
        </p>
        {error ? (
          <p className="mt-2 text-xs text-[#B53D2A]">{error}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Bulk paste — async/queued, unchanged ────────────────────────────────

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
          placeholder={
            "https://amazon.com/...\nhttps://reformation.com/...\nhttps://aloyoga.com/..."
          }
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm font-mono outline-none focus:border-rose"
        />
        <p className="mt-1.5 text-xs text-muted">
          Up to 30 URLs at a time. Each one is fetched in parallel and
          shows up as a "Fetching…" card in your closet — open any card
          to fill in missing details.
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
