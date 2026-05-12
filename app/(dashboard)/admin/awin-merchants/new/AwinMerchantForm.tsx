"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AWIN_STATUS_LABEL,
  type AwinMerchant,
  type AwinMerchantStatus,
} from "@/types/awin";
import {
  createAwinMerchantAction,
  updateAwinMerchantAction,
  type AwinMerchantDraft,
} from "@/lib/awin/mutations";

interface Props {
  mode: "create" | "edit";
  initial?: AwinMerchant;
}

const STATUS_OPTIONS: AwinMerchantStatus[] = [
  "active",
  "pending",
  "paused",
  "terminated",
];

export function AwinMerchantForm({ mode, initial }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [awinmid, setAwinmid] = useState(initial?.awinmid ?? "");
  const [merchantName, setMerchantName] = useState(initial?.merchantName ?? "");
  const [domain, setDomain] = useState(initial?.domain ?? "");
  const [altDomainsRaw, setAltDomainsRaw] = useState(
    initial?.altDomains?.join("\n") ?? "",
  );
  const [commissionMin, setCommissionMin] = useState<string>(
    initial?.commissionMin?.toString() ?? "",
  );
  const [commissionMax, setCommissionMax] = useState<string>(
    initial?.commissionMax?.toString() ?? "",
  );
  const [cookieLength, setCookieLength] = useState<string>(
    initial?.cookieLength?.toString() ?? "",
  );
  const [awinIndex, setAwinIndex] = useState<string>(
    initial?.awinIndex?.toString() ?? "",
  );
  const [status, setStatus] = useState<AwinMerchantStatus>(
    initial?.status ?? "pending",
  );
  const [awinJoinUrl, setAwinJoinUrl] = useState(initial?.awinJoinUrl ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const toNum = (s: string): number | null => {
      const t = s.trim();
      if (!t) return null;
      const n = Number(t);
      return Number.isFinite(n) ? n : null;
    };

    const draft: AwinMerchantDraft = {
      awinmid: awinmid.trim(),
      merchantName: merchantName.trim(),
      domain: domain.trim(),
      altDomainsRaw,
      commissionMin: toNum(commissionMin),
      commissionMax: toNum(commissionMax),
      cookieLength: toNum(cookieLength) === null ? null : Math.round(Number(cookieLength)),
      awinIndex: toNum(awinIndex) === null ? null : Math.round(Number(awinIndex)),
      status,
      awinJoinUrl: awinJoinUrl.trim() || null,
      notes: notes.trim() || null,
    };

    startTransition(async () => {
      const result =
        mode === "create"
          ? await createAwinMerchantAction(draft)
          : await updateAwinMerchantAction(initial!.id, draft);

      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.push("/admin/awin-merchants");
      router.refresh();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Merchant identity */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
        <Field
          label="Awin merchant ID"
          hint="Numeric ID from the Awin advertiser directory (advertiserId)."
          required
        >
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={awinmid}
            onChange={(e) => setAwinmid(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
            placeholder="93915"
          />
        </Field>

        <Field label="Merchant name" required>
          <input
            type="text"
            value={merchantName}
            onChange={(e) => setMerchantName(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
            placeholder="Collina Strada"
          />
        </Field>
      </div>

      <Field
        label="Primary domain"
        hint="Lowercase hostname without protocol or www — e.g. collinastrada.com. Used to recognize creator URLs."
        required
      >
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
          placeholder="collinastrada.com"
        />
      </Field>

      <Field
        label="Alt domains"
        hint="One per line. Use for US/UK splits or sub-brand domains the merchant also uses."
      >
        <textarea
          value={altDomainsRaw}
          onChange={(e) => setAltDomainsRaw(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose font-mono"
          placeholder={"us.collinastrada.com\nshop.collinastrada.com"}
        />
      </Field>

      {/* Economics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Field label="Commission min %">
          <input
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={commissionMin}
            onChange={(e) => setCommissionMin(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
            placeholder="5"
          />
        </Field>
        <Field label="Commission max %">
          <input
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={commissionMax}
            onChange={(e) => setCommissionMax(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
            placeholder="15"
          />
        </Field>
        <Field label="Cookie days">
          <input
            type="number"
            min={0}
            max={365}
            value={cookieLength}
            onChange={(e) => setCookieLength(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
            placeholder="30"
          />
        </Field>
        <Field label="Awin Index">
          <input
            type="number"
            min={0}
            max={100}
            value={awinIndex}
            onChange={(e) => setAwinIndex(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
            placeholder="80"
          />
        </Field>
      </div>

      {/* Status + links */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-4">
        <Field
          label="Status"
          hint="Only 'active' merchants get URL recognition."
          required
        >
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as AwinMerchantStatus)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {AWIN_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Awin program URL"
          hint="Link to this merchant's program page in your Awin dashboard."
        >
          <input
            type="url"
            value={awinJoinUrl}
            onChange={(e) => setAwinJoinUrl(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
            placeholder="https://ui.awin.com/merchant-profile/93915"
          />
        </Field>
      </div>

      <Field
        label="Internal notes"
        hint="Anything to remember about this program — bonus rates, contact, exclusivity terms."
      >
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
        />
      </Field>

      {error ? (
        <div className="rounded-lg border border-rose/30 bg-rose/5 px-4 py-3 text-sm text-rose">
          {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-rose text-white px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {isPending ? "Saving…" : mode === "create" ? "Add merchant" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/awin-merchants")}
          className="px-4 py-2 text-sm text-muted hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
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
      <span className="block text-xs uppercase tracking-widest text-muted mb-1.5">
        {label}
        {required ? <span className="text-rose ml-1">*</span> : null}
      </span>
      {children}
      {hint ? <span className="block text-xs text-muted mt-1">{hint}</span> : null}
    </label>
  );
}
