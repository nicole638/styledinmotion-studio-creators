"use client";

import { useEffect, useState, useTransition } from "react";
import { X, Sparkles, ShieldCheck, Truck, BadgeCheck } from "lucide-react";
import { submitConsignmentRequestAction } from "@/lib/consignment/mutations";
import type { ClosetItem } from "@/types/closet";
import { consignEligibility } from "@/lib/consignment/eligibility";

interface Props {
  item: ClosetItem;
  onClose: () => void;
  onSubmitted: (requestId: string) => void;
}

/**
 * Consign-with-The-RealReal modal. Slides up from the bottom, shows the
 * item photo + brand + estimated payout range, a 3-point value prop,
 * and a primary CTA. Submit calls the server action which:
 *   - Inserts into consignment_requests
 *   - Emails nicole@styledinmotion.app (the magic-moment notify)
 *   - Returns the new request id
 *
 * On success the modal swaps to a confirmation state. The parent
 * (ClosetItemsList) reads the result and flips the card pill to
 * "Consigning ✓" so refresh shows it persistently.
 */
export function ConsignmentModal({ item, onClose, onSubmitted }: Props) {
  const elig = consignEligibility(item.brand, item.category, item.price);
  const [submitting, startSubmit] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ requestId: string } | null>(null);

  // Esc closes the modal — feels native to keyboard users.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSubmit = () => {
    setError(null);
    startSubmit(async () => {
      const r = await submitConsignmentRequestAction(item.id);
      if (r.ok && r.requestId) {
        setDone({ requestId: r.requestId });
        onSubmitted(r.requestId);
      } else {
        setError(r.error ?? "Couldn't submit. Try again.");
      }
    });
  };

  const payoutLabel =
    elig.payoutMinUsd != null && elig.payoutMaxUsd != null
      ? `$${elig.payoutMinUsd.toLocaleString()} – $${elig.payoutMaxUsd.toLocaleString()}`
      : "—";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        // Click outside the modal card closes — but ignore clicks
        // bubbling up from inside.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Consign with The RealReal"
        className="bg-card border border-border rounded-t-3xl md:rounded-3xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-bg border border-border grid place-items-center hover:border-rose transition-colors z-10"
          >
            <X size={14} strokeWidth={2} />
          </button>

          {done ? (
            <SuccessState
              brand={item.brand}
              payoutLabel={payoutLabel}
              onClose={onClose}
            />
          ) : (
            <ActiveState
              item={item}
              payoutLabel={payoutLabel}
              error={error}
              submitting={submitting}
              onSubmit={handleSubmit}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ActiveState({
  item,
  payoutLabel,
  error,
  submitting,
  onSubmit,
}: {
  item: ClosetItem;
  payoutLabel: string;
  error: string | null;
  submitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <>
      {/* Photo header */}
      <div className="bg-bg aspect-[4/3] grid place-items-center border-b border-border">
        {item.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.photoUrl}
            alt={item.name ?? "Item"}
            className="max-h-full max-w-full object-contain p-6"
          />
        ) : (
          <span className="text-xs uppercase tracking-widest text-muted">
            No photo
          </span>
        )}
      </div>

      <div className="px-6 pt-6 pb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-rose mb-2 flex items-center gap-1.5">
          <Sparkles size={11} strokeWidth={2.25} />
          Consign with The RealReal
        </p>
        <h2 className="font-display text-2xl leading-tight">
          {item.brand ? `${item.brand} ` : ""}
          {item.name ?? "this piece"}
        </h2>

        <div className="mt-5 p-4 rounded-2xl bg-bg border border-border">
          <p className="text-xs uppercase tracking-widest text-muted mb-1">
            Estimated payout
          </p>
          <p className="text-3xl font-display text-rose">{payoutLabel}</p>
          <p className="mt-2 text-xs text-muted leading-relaxed">
            Range based on similar items currently listed. Final payout
            confirmed after authentication.
          </p>
        </div>

        <ul className="mt-5 space-y-3">
          <ValueRow
            icon={<Truck size={16} strokeWidth={2} className="text-rose" />}
            label="Free pickup"
            detail="Scheduled within 24 hours, prepaid shipping label included."
          />
          <ValueRow
            icon={
              <ShieldCheck
                size={16}
                strokeWidth={2}
                className="text-rose"
              />
            }
            label="Authenticated by experts"
            detail="The RealReal's brand specialists confirm condition + authenticity."
          />
          <ValueRow
            icon={
              <BadgeCheck size={16} strokeWidth={2} className="text-rose" />
            }
            label="Get paid in 7–10 days"
            detail="Direct deposit once your item sells. Track everything in your closet."
          />
        </ul>

        {error ? (
          <div
            role="alert"
            className="mt-4 text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3"
          >
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onSubmit}
          disabled={submitting}
          className="mt-6 w-full inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-3.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {submitting ? "Sending…" : "Send to The RealReal"}
        </button>
        <p className="mt-3 text-[11px] text-muted text-center leading-relaxed">
          By tapping send, you authorize The RealReal to contact you about
          pickup. You can cancel any time before pickup.
        </p>
      </div>
    </>
  );
}

function SuccessState({
  brand,
  payoutLabel,
  onClose,
}: {
  brand: string | null;
  payoutLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="px-6 pt-12 pb-8 text-center">
      <div className="w-16 h-16 rounded-full bg-rose/15 grid place-items-center mx-auto">
        <BadgeCheck size={28} strokeWidth={2} className="text-rose" />
      </div>
      <h2 className="font-display text-2xl mt-5 leading-tight">
        Your{brand ? ` ${brand}` : ""} is on its way.
      </h2>
      <p className="mt-3 text-sm text-muted leading-relaxed max-w-xs mx-auto">
        The RealReal will email you within 24 hours to schedule pickup.
        Estimated payout once sold:
      </p>
      <p className="mt-3 text-2xl font-display text-rose">{payoutLabel}</p>
      <button
        type="button"
        onClick={onClose}
        className="mt-7 inline-flex items-center justify-center rounded-full bg-rose text-white px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        Back to closet
      </button>
    </div>
  );
}

function ValueRow({
  icon,
  label,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  detail: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-rose/10 grid place-items-center shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text">{label}</p>
        <p className="text-xs text-muted mt-0.5 leading-relaxed">{detail}</p>
      </div>
    </li>
  );
}
