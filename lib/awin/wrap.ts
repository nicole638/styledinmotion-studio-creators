"use server";

import { createClient } from "@/lib/supabase/server";
import { findAwinMerchantForUrl } from "./queries";
import type { AwinMerchant } from "@/types/awin";

/**
 * Our public Awin publisher id (`awinaffid` in every Awin tracked URL we
 * generate). Falls back to the literal value because this is the public-
 * facing portion of every Awin link anyway — not a secret. The env var
 * lets us swap it without a deploy if the account ever changes.
 */
const AWIN_PUBLISHER_ID = process.env.AWIN_PUBLISHER_ID || "2891857";

export interface WrapAwinResult {
  /** Awin tracked URL — drop into creator_items.url (or .affiliate_url). */
  wrappedUrl: string;
  /** The merchant we matched on, for the auto-wrap hint UI. */
  merchant: AwinMerchant;
}

/**
 * Server action: given a raw merchant URL the creator just pasted into Add
 * Item, return the Awin-wrapped version with `clickref` stamped to the
 * current creator's UUID. Backend `/api/shop` will rewrite `clickref` on
 * each click_event anyway, but stamping it at wrap-time means the URL is
 * already correctly attributed if anyone shares/clicks it directly.
 *
 * Returns null when:
 *   - URL doesn't match any active Awin merchant in `awin_merchants`
 *   - User isn't signed in (no clickref to stamp)
 *   - Anything throws — auto-wrap is an enhancement, never a blocker.
 */
export async function wrapAwinUrlAction(
  rawUrl: string,
): Promise<WrapAwinResult | null> {
  if (!rawUrl) return null;

  try {
    const merchant = await findAwinMerchantForUrl(rawUrl);
    if (!merchant) return null;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const wrappedUrl = buildAwinUrl({
      awinmid: merchant.awinmid,
      awinaffid: AWIN_PUBLISHER_ID,
      clickref: user.id,
      destination: rawUrl.trim(),
    });

    return { wrappedUrl, merchant };
  } catch {
    return null;
  }
}

/**
 * Build a canonical Awin tracked URL. Mirrors the format the backend
 * `/api/shop` handler expects:
 *
 *   https://www.awin1.com/cread.php
 *     ?awinmid=<merchant>
 *     &awinaffid=<publisher>
 *     &clickref=<creator UUID>
 *     &p=<encoded merchant destination>
 *
 * `URLSearchParams` handles encoding of the destination URL automatically
 * (so `&` etc. inside the merchant URL get %26'd, etc.).
 */
function buildAwinUrl(args: {
  awinmid: string;
  awinaffid: string;
  clickref: string;
  destination: string;
}): string {
  const params = new URLSearchParams({
    awinmid: args.awinmid,
    awinaffid: args.awinaffid,
    clickref: args.clickref,
    p: args.destination,
  });
  return `https://www.awin1.com/cread.php?${params.toString()}`;
}
