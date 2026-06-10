"use client";

import { useEffect, useState } from "react";
import { X, Check, ExternalLink, Sparkles } from "lucide-react";
import type { ClosetItem } from "@/types/closet";

/**
 * Minimal Consign modal — the only friction between the closet pill and
 * TRR's partnership LP. Contents are intentionally tight:
 *
 *   - Item photo
 *   - Brand + item name
 *   - "I own this item" checkbox (REQUIRED — gates the CTA)
 *   - "Continue on The RealReal" button (disabled until checked)
 *
 * Everything downstream (payout estimate, pickup scheduling, authentication,
 * disbursement) lives on TRR's LP. We don't promise numbers we don't own.
 *
 * On Continue: fires a click_events beacon (affiliate_network='trr_partnership')
 * so the click shows up in /admin/click-analytics and we can reconcile against
 * the unique-identifier feed TRR returns. Then opens the LP in a new tab.
 */

const TRR_PARTNERSHIP_LP = "https://www.therealreal.com/styledinmotion";

interface Props {
  item: ClosetItem;
  onClose: () => void;
  onConsigned: () => void;
}

export function ConsignmentModal({ item, onClose, onConsigned }: Props) {
  const [ownsItem, setOwnsItem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleConsign = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!ownsItem) {
      e.preventDefault();
      setError("Please confirm you own this item before continuing.");
      return;
    }
    setError(null);
    try {
      const blob = new Blob(
        [
          JSON.stringify({
            surface: "consign_modal",
            destination: TRR_PARTNERSHIP_LP,
            item_id: item.id,
            affiliate_network: "trr_partnership",
          }),
        ],
        { type: "application/json" },
      );
      navigator.sendBeacon?.("/api/consign/click", blob);
    } catch {
      /* never block navigation */
    }
    onConsigned();
  };

  // De-dupe brand prefix: scraped product names from luxury merchants almost
  // always already include the brand at the start (e.g. name="Prada Arque
  // Printed Leather Mini Shoulder Bag", brand="Prada" → don't prepend or we
  // get "Prada Prada Arque…"). Case-insensitive prefix check.
  const rawName = item.name ?? "this piece";
  const brandPrefix = item.brand?.trim() ?? "";
  const nameStartsWithBrand =
    brandPrefix.length > 0 &&
    rawName.trim().toLowerCase().startsWith(brandPrefix.toLowerCase());
  const heading = nameStartsWithBrand || !brandPrefix
    ? rawName
    : `${brandPrefix} ${rawName}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Confirm ownership before consigning"
        className="bg-card border border-border rounded-t-3xl md:rounded-3xl w-full max-w-md shadow-2xl overflow-hidden"
      >
        <div className="relative">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-card/90 backdrop-blur border border-border grid place-items-center hover:border-rose transition-colors"
          >
            <X size={14} strokeWidth={2} />
          </button>

          {/* Photo */}
          <div className="bg-bg aspect-[4/3] grid place-items-center border-b border-border">
            {item.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.photoUrl}
                alt={display}
                className="max-h-full max-w-full object-contain p-6"
              />
            ) : (
              <span className="text-xs uppercase tracking-widest text-muted">
                No photo
              </span>
            )}
          </div>

          <div className="px-6 pt-6 pb-6">
            {/* Brand + item name */}
            <h2 className="font-display text-2xl leading-tight">
              {item.brand ? `${item.brand} ` : ""}
              {display}
            </h2>

            {/* First-time-consignor promo. Active for the Q3 push window
                (July / August / September). Hard-coded for now — if we
                run a different promo next quarter, swap the copy here
                and propagate to iOS. */}
            <div className="mt-5 rounded-2xl border border-rose/30 bg-rose/5 p-4">
              <p className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-rose">
                <Sparkles size={11} strokeWidth={2.25} />
                Styled in Motion creators
              </p>
              <p className="mt-1.5 font-display text-xl leading-tight text-text">
                Get $200 your first time
              </p>
              <p className="mt-1.5 text-xs text-muted leading-relaxed">
                Styled in Motion Creators get $200 when you consign for the
                first time in July, August, or September.
              </p>
            </div>

            {/* Ownership checkbox — gates the CTA */}
            <label className="mt-6 flex items-start gap-3 cursor-pointer select-none rounded-2xl border border-border bg-bg p-4 hover:border-rose/40 transition-colors">
              <span
                className={`mt-0.5 grid place-items-center w-5 h-5 rounded-md border-2 transition-colors shrink-0 ${
                  ownsItem ? "bg-rose border-rose" : "bg-white border-border"
                }`}
              >
                {ownsItem ? (
                  <Check size={12} strokeWidth={3} className="text-white" />
                ) : null}
              </span>
              <span className="flex-1 text-sm leading-relaxed text-text">
                <strong className="font-medium">I own this item.</strong>{" "}
                <span className="text-muted">
                  I have the physical piece, not just a styled version from
                  the brand catalog.
                </span>
              </span>
              <input
                type="checkbox"
                checked={ownsItem}
                onChange={(e) => {
                  setOwnsItem(e.target.checked);
                  if (e.target.checked) setError(null);
                }}
                className="sr-only"
                aria-label="I own this item"
              />
            </label>

            {error ? (
              <div
                role="alert"
                className="mt-4 text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3"
              >
                {error}
              </div>
            ) : null}

            <a
              href={TRR_PARTNERSHIP_LP}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleConsign}
              className={`mt-5 w-full inline-flex items-center justify-center gap-2 rounded-full px-5 py-3.5 text-sm font-medium transition-opacity ${
                ownsItem
                  ? "bg-rose text-white hover:opacity-90"
                  : "bg-rose/40 text-white cursor-not-allowed"
              }`}
              aria-disabled={!ownsItem}
            >
              Continue on The RealReal
              <ExternalLink size={14} strokeWidth={2.25} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
