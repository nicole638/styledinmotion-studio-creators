"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createCampaignAction,
  updateCampaignAction,
  type CampaignDraft,
} from "@/lib/campaigns/mutations";
import {
  CAMPAIGN_TYPE_LABEL,
  CAMPAIGN_SOURCE_LABEL,
  type Campaign,
  type CampaignType,
  type CampaignSource,
} from "@/types/campaigns";

type Mode = "create" | "edit";

interface Props {
  mode: Mode;
  initial?: Campaign;
}

export function CampaignForm({ mode, initial }: Props) {
  const router = useRouter();
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [brandName, setBrandName] = useState(initial?.brandName ?? "");
  const [brandLogoUrl, setBrandLogoUrl] = useState(initial?.brandLogoUrl ?? "");
  const [asinsRaw, setAsinsRaw] = useState(
    (initial?.asins ?? []).join("\n"),
  );
  const [startDate, setStartDate] = useState(initial?.startDate ?? "");
  const [endDate, setEndDate] = useState(initial?.endDate ?? "");
  const [commissionRatePct, setCommissionRatePct] = useState<string>(
    initial?.commissionRatePct?.toString() ?? "",
  );
  const [campaignType, setCampaignType] = useState<CampaignType>(
    initial?.campaignType ?? "affiliate_plus",
  );
  const [source, setSource] = useState<CampaignSource>(
    initial?.source ?? "amazon_cc",
  );
  const [budgetTotalUsd, setBudgetTotalUsd] = useState<string>(
    initial?.budgetTotalUsd?.toString() ?? "",
  );
  const [budgetRemainingUsd, setBudgetRemainingUsd] = useState<string>(
    initial?.budgetRemainingUsd?.toString() ?? "",
  );
  const [campaignUrl, setCampaignUrl] = useState(initial?.campaignUrl ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rate = Number.parseFloat(commissionRatePct);
    if (!Number.isFinite(rate)) {
      setError("Commission rate must be a number.");
      return;
    }

    const draft: CampaignDraft = {
      brandName,
      brandLogoUrl: brandLogoUrl || null,
      asinsRaw,
      startDate,
      endDate,
      commissionRatePct: rate,
      campaignType,
      source,
      notes: notes || null,
      budgetTotalUsd: budgetTotalUsd ? Number.parseFloat(budgetTotalUsd) : null,
      budgetRemainingUsd: budgetRemainingUsd
        ? Number.parseFloat(budgetRemainingUsd)
        : null,
      campaignUrl: campaignUrl || null,
    };

    startBusy(async () => {
      const r =
        mode === "create"
          ? await createCampaignAction(draft)
          : await updateCampaignAction(initial!.id, draft);
      if (!r.ok) {
        setError(r.error ?? "Could not save.");
        return;
      }
      router.push("/admin/campaigns");
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Brand */}
      <FieldRow label="Brand name" required>
        <input
          required
          value={brandName}
          onChange={(e) => setBrandName(e.target.value)}
          placeholder="e.g. ELEMIS"
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      <FieldRow label="Brand logo URL" hint="Optional. Square works best.">
        <input
          type="url"
          value={brandLogoUrl}
          onChange={(e) => setBrandLogoUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      {/* Window */}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Start date" required>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
        <FieldRow label="End date" required>
          <input
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
      </div>

      {/* Type / source / rate */}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Campaign type" required>
          <select
            value={campaignType}
            onChange={(e) => setCampaignType(e.target.value as CampaignType)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          >
            {(Object.keys(CAMPAIGN_TYPE_LABEL) as CampaignType[]).map((t) => (
              <option key={t} value={t}>
                {CAMPAIGN_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Source" required>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as CampaignSource)}
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          >
            {(Object.keys(CAMPAIGN_SOURCE_LABEL) as CampaignSource[]).map((s) => (
              <option key={s} value={s}>
                {CAMPAIGN_SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </FieldRow>
      </div>

      <FieldRow
        label="Bonus commission rate (%)"
        hint="Amazon Creator Connections range: 10–50. This is on top of the standard commission."
        required
      >
        <input
          type="number"
          required
          step="0.01"
          min="0"
          max="100"
          value={commissionRatePct}
          onChange={(e) => setCommissionRatePct(e.target.value)}
          placeholder="12.00"
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      {/* ASINs */}
      <FieldRow
        label="ASINs"
        hint="Paste from the campaign page. One per line, or separate with spaces/commas. Format: B0XXXXXXXX (B + 9 alphanumeric)."
        required
      >
        <textarea
          required
          rows={6}
          value={asinsRaw}
          onChange={(e) => setAsinsRaw(e.target.value)}
          placeholder={"B09YCYYHB6\nB0B864M43K\nB0D8CJYFH9"}
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm font-mono outline-none focus:border-rose"
        />
      </FieldRow>

      {/* Budget */}
      <div className="grid grid-cols-2 gap-3">
        <FieldRow label="Total budget (USD)" hint="Optional">
          <input
            type="number"
            step="0.01"
            min="0"
            value={budgetTotalUsd}
            onChange={(e) => setBudgetTotalUsd(e.target.value)}
            placeholder="50000.00"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
        <FieldRow label="Remaining budget (USD)" hint="Optional">
          <input
            type="number"
            step="0.01"
            min="0"
            value={budgetRemainingUsd}
            onChange={(e) => setBudgetRemainingUsd(e.target.value)}
            placeholder="42500.00"
            className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
          />
        </FieldRow>
      </div>

      <FieldRow
        label="Campaign URL"
        hint="The 'Get affiliate link' URL from Amazon CC. Optional."
      >
        <input
          type="url"
          value={campaignUrl}
          onChange={(e) => setCampaignUrl(e.target.value)}
          placeholder="https://www.amazon.com/…"
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      <FieldRow
        label="Notes"
        hint="Anything Kerri or you should remember about this campaign — content guidelines, brand contact, etc."
      >
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-sm outline-none focus:border-rose"
        />
      </FieldRow>

      {error ? (
        <div className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {busy ? "Saving…" : mode === "create" ? "Add campaign" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

function FieldRow({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-xs uppercase tracking-widest text-muted">
          {label}
          {required ? <span className="text-rose ml-0.5">*</span> : null}
        </span>
        {hint ? (
          <span className="text-xs text-muted/70 normal-case tracking-normal">
            {hint}
          </span>
        ) : null}
      </div>
      {children}
    </label>
  );
}
