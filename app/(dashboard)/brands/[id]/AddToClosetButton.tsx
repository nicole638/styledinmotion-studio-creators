"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Plus } from "lucide-react";
import { addBrandProductToClosetAction } from "@/lib/brands/mutations";

interface Props {
  productId: string;
  initiallyAdded: boolean;
}

/**
 * Per-card "+ Add" pill. Three states:
 *   idle    → "+ Add"          (rose outline)
 *   loading → spinner
 *   added   → "✓ Added"        (filled rose)
 *
 * Mirrors the iOS pill-morph pattern. The pill is idempotent end-to-end:
 * the server action returns `alreadyAdded: true` if a duplicate would
 * have been inserted, and we land in the "added" state either way.
 *
 * Errors surface in a tiny inline label below the pill. We deliberately
 * don't toast — keeps the per-card add path local and quiet.
 */
export function AddToClosetButton({ productId, initiallyAdded }: Props) {
  const [added, setAdded] = useState(initiallyAdded);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onAdd() {
    if (added || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await addBrandProductToClosetAction(productId);
      if (result.ok) {
        setAdded(true);
        return;
      }
      setError(result.error ?? "Add failed");
    });
  }

  if (added) {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose text-white text-[11px] font-medium">
        <Check size={11} strokeWidth={2.5} /> Added
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={onAdd}
        disabled={pending}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-rose text-rose text-[11px] font-medium hover:bg-rose hover:text-white transition-colors disabled:opacity-60 disabled:cursor-wait"
        aria-label={pending ? "Adding to closet" : "Add to closet"}
      >
        {pending ? (
          <Loader2 size={11} className="animate-spin" strokeWidth={2.5} />
        ) : (
          <Plus size={11} strokeWidth={2.5} />
        )}
        {pending ? "Adding…" : "Add"}
      </button>
      {error ? (
        <span className="text-[10px] text-rose" title={error}>
          {error.length > 18 ? "Add failed" : error}
        </span>
      ) : null}
    </div>
  );
}
