"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import {
  updateStorefrontAction,
  type StorefrontFormInput,
} from "@/lib/storefronts/actions";
import type {
  BrandStatus,
  BrandStorefront,
  FulfillmentEntry,
} from "@/types/storefronts";

const STATUS_OPTIONS: BrandStatus[] = ["active", "paused", "archived"];
const CHANNEL_OPTIONS = ["etsy", "ebay", "shopify"] as const;

const INPUT_CLS =
  "w-full rounded-lg border border-border bg-input px-3 py-2 text-sm focus:outline-none focus:border-rose";

export function StorefrontEditForm({ storefront }: { storefront: BrandStorefront }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [name, setName] = useState(storefront.name);
  const [slug, setSlug] = useState(storefront.slug);
  const [brandStory, setBrandStory] = useState(storefront.brandStory ?? "");
  const [commissionPct, setCommissionPct] = useState(storefront.commissionPct);
  const [promoCode, setPromoCode] = useState(storefront.promoCode ?? "");
  const [contactEmail, setContactEmail] = useState(storefront.contactEmail ?? "");
  const [status, setStatus] = useState<BrandStatus>(storefront.status);
  const [isTest, setIsTest] = useState(storefront.isTest);
  const [fulfillment, setFulfillment] = useState<FulfillmentEntry[]>(
    storefront.fulfillment,
  );

  function addRow() {
    setFulfillment((r) => [...r, { channel: "etsy", url: "" }]);
  }
  function removeRow(idx: number) {
    setFulfillment((r) => r.filter((_, i) => i !== idx));
  }
  function updateRow(idx: number, patch: Partial<FulfillmentEntry>) {
    setFulfillment((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
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
      const res = await updateStorefrontAction(storefront.id, payload);
      if (!res.ok) {
        setError(res.error ?? "Could not save.");
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 bg-white border border-border rounded-2xl p-5">
      {error ? (
        <div className="p-3 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      ) : null}
      {saved ? (
        <div className="p-3 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
          Saved.
        </div>
      ) : null}

      <Field label="Brand name" required>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className={INPUT_CLS}
        />
      </Field>

      <Field label="Slug" required hint="Changing the slug breaks existing /brand/<old> shopper links.">
        <input
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          required
          pattern="[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?"
          className={`${INPUT_CLS} font-mono`}
        />
      </Field>

      <Field label="Brand story">
        <textarea
          value={brandStory}
          onChange={(e) => setBrandStory(e.target.value)}
          rows={5}
          className={INPUT_CLS}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Commission %" required>
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={commissionPct}
            onChange={(e) => setCommissionPct(parseFloat(e.target.value || "0"))}
            required
            className={INPUT_CLS}
          />
        </Field>
        <Field label="Promo code">
          <input
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            className={`${INPUT_CLS} font-mono`}
          />
        </Field>
      </div>

      <Field label="Contact email" required>
        <input
          type="email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          required
          className={INPUT_CLS}
        />
      </Field>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-ink">
            Off-Amazon fulfillment
          </label>
          <button
            type="button"
            onClick={addRow}
            className="inline-flex items-center gap-1 text-sm text-rose hover:opacity-80"
          >
            <Plus size={14} /> Add channel
          </button>
        </div>
        <div className="space-y-2">
          {fulfillment.length === 0 ? (
            <p className="text-sm text-muted italic">None.</p>
          ) : (
            fulfillment.map((row, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={row.channel}
                  onChange={(e) => updateRow(idx, { channel: e.target.value })}
                  className={`${INPUT_CLS} w-32`}
                >
                  {CHANNEL_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  value={row.url}
                  onChange={(e) => updateRow(idx, { url: e.target.value })}
                  placeholder="https://"
                  className={`${INPUT_CLS} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
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
        <Field label="Status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as BrandStatus)}
            className={INPUT_CLS}
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
            <span>Hidden from public/analytics</span>
          </label>
        </Field>
      </div>

      <div className="pt-4 border-t border-border flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-2.5 rounded-full bg-ink text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save changes"}
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
