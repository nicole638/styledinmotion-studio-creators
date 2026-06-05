"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  createStorefrontAction,
  type StorefrontFormInput,
} from "@/lib/storefronts/actions";
import type { BrandStatus, FulfillmentEntry } from "@/types/storefronts";

const STATUS_OPTIONS: BrandStatus[] = ["active", "paused", "archived"];
const CHANNEL_OPTIONS = ["etsy", "ebay", "shopify"] as const;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function NewStorefrontForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [brandStory, setBrandStory] = useState("");
  const [commissionPct, setCommissionPct] = useState(15);
  const [promoCode, setPromoCode] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [status, setStatus] = useState<BrandStatus>("active");
  const [isTest, setIsTest] = useState(false);
  const [fulfillment, setFulfillment] = useState<FulfillmentEntry[]>([]);

  // Auto-derive slug from name until the user edits it manually.
  function onNameChange(v: string) {
    setName(v);
    if (!slugTouched) setSlug(slugify(v));
  }

  function addFulfillmentRow() {
    setFulfillment((rows) => [...rows, { channel: "etsy", url: "" }]);
  }
  function removeFulfillmentRow(idx: number) {
    setFulfillment((rows) => rows.filter((_, i) => i !== idx));
  }
  function updateFulfillmentRow(idx: number, patch: Partial<FulfillmentEntry>) {
    setFulfillment((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const payload: StorefrontFormInput = {
      name: name.trim(),
      slug: slug.trim(),
      brandStory,
      commissionPct,
      promoCode,
      contactEmail,
      fulfillment: fulfillment.filter((f) => f.url.trim().length > 0),
      status,
      isTest,
    };
    startTransition(async () => {
      const res = await createStorefrontAction(payload);
      if (!res.ok || !res.storefrontId) {
        setError(res.error ?? "Could not create storefront.");
        return;
      }
      router.push(`/admin/storefronts/${res.storefrontId}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {error ? (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      ) : null}

      <Field label="Brand name" required>
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
          placeholder="Golden Bear Garage"
        />
      </Field>

      <Field
        label="Slug"
        required
        hint="URL handle. Lowercase letters, numbers, hyphens. Drives /brand/<slug>."
      >
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          required
          pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose font-mono text-sm"
          placeholder="golden-bear-garage"
        />
      </Field>

      <Field label="Brand story" hint="Public-facing copy shown on the brand page.">
        <textarea
          value={brandStory}
          onChange={(e) => setBrandStory(e.target.value)}
          rows={5}
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Commission %" required hint="SiM's cut, 0-100.">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={commissionPct}
            onChange={(e) => setCommissionPct(parseFloat(e.target.value || "0"))}
            required
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
          />
        </Field>
        <Field label="Promo code">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose font-mono"
            placeholder="GBG10"
          />
        </Field>
      </div>

      <Field label="Contact email" required>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
          placeholder="goldenbeargarage@gmail.com"
        />
      </Field>

      {/* Fulfillment */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-ink">
            Off-Amazon fulfillment
          </label>
          <button
            type="button"
            onClick={addFulfillmentRow}
            className="inline-flex items-center gap-1 text-sm text-rose hover:opacity-80"
          >
            <Plus size={14} /> Add channel
          </button>
        </div>
        <p className="text-xs text-muted mb-3">
          Etsy / eBay / Shopify shop URLs the brand drives traffic to outside Amazon.
        </p>
        <div className="space-y-2">
          {fulfillment.length === 0 ? (
            <p className="text-sm text-muted italic">None — Amazon-only at launch.</p>
          ) : (
            fulfillment.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={row.channel}
                  onChange={(e) =>
                    updateFulfillmentRow(idx, { channel: e.target.value })
                  }
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose w-32"
                >
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  value={row.url}
                  onChange={(e) =>
                    updateFulfillmentRow(idx, { url: e.target.value })
                  }
                  placeholder="https://"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose flex-1"
                />
                <button
                  type="button"
                  onClick={() => removeFulfillmentRow(idx)}
                  className="text-muted hover:text-red-600 p-2"
                  aria-label="Remove"
                >
                  <X size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Status" required>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BrandStatus)}
            className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Test brand">
          <label className="flex items-center gap-2 h-[42px] text-sm">
            <input
              type="checkbox"
              checked={isTest}
              onChange={(e) => setIsTest(e.target.checked)}
              className="w-4 h-4 accent-rose"
            />
            <span>Hidden from public/analytics by default</span>
          </label>
        </Field>
      </div>

      <div className="pt-4 border-t border-border flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/admin/storefronts")}
          className="px-5 py-2.5 rounded-full border border-border text-ink hover:bg-bg/40"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-full bg-ink text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create storefront"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">
        {label}
        {required ? <span className="text-rose ml-0.5">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted mt-1.5">{hint}</p> : null}
    </div>
  );
}
