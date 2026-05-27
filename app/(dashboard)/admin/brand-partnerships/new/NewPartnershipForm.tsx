"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPartnershipAction } from "./actions";

export default function NewPartnershipForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createPartnershipAction(formData);
      if (!res.ok) {
        setError(res.error ?? "Failed to create campaign.");
        return;
      }
      router.push("/admin/brand-partnerships");
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <Field
        name="brand_name"
        label="Brand"
        placeholder="Bloomingdale's"
        required
      />
      <Field
        name="campaign_name"
        label="Campaign name"
        placeholder="Summer Looks · June 2026"
        required
      />
      <Field
        name="brief"
        label="Brief"
        placeholder="What we're asking creators to produce and any guardrails (look style, hashtags, do/don'ts)."
        multiline
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field
          name="payout_per_creator"
          label="Payout per creator (USD)"
          placeholder="100"
          type="number"
          step="0.01"
        />
        <Field
          name="max_creators"
          label="Max creators"
          placeholder="10"
          type="number"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Field name="starts_at" label="Starts" type="date" />
        <Field name="ends_at" label="Ends" type="date" />
      </div>

      <Field
        name="total_budget"
        label="Total budget (USD)"
        placeholder="1000"
        type="number"
        step="0.01"
      />

      <div>
        <label
          htmlFor="status"
          className="block text-xs uppercase tracking-wider text-muted font-medium mb-2"
        >
          Status
        </label>
        <select
          id="status"
          name="status"
          defaultValue="draft"
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
        >
          <option value="draft">Draft — not yet visible</option>
          <option value="open">Open — actively recruiting</option>
          <option value="live">Live — creators executing</option>
          <option value="filled">Filled — no more spots</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <Field
        name="notes"
        label="Internal notes"
        placeholder="Anything else useful (point of contact, payment terms, etc.)"
        multiline
      />

      {error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center rounded-full bg-rose text-white px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create campaign"}
        </button>
        <a
          href="/admin/brand-partnerships"
          className="inline-flex items-center justify-center rounded-full border border-border bg-card text-text px-6 py-3 text-sm font-medium hover:bg-bg transition"
        >
          Cancel
        </a>
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  placeholder,
  type = "text",
  step,
  required,
  multiline,
}: {
  name: string;
  label: string;
  placeholder?: string;
  type?: string;
  step?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-xs uppercase tracking-wider text-muted font-medium mb-2"
      >
        {label}
        {required ? <span className="text-rose"> *</span> : null}
      </label>
      {multiline ? (
        <textarea
          id={name}
          name={name}
          placeholder={placeholder}
          required={required}
          rows={3}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm leading-relaxed"
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          step={step}
          placeholder={placeholder}
          required={required}
          className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm"
        />
      )}
    </div>
  );
}
