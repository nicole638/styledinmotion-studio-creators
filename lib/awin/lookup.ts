"use server";

import { findAwinMerchantForUrl } from "./queries";
import type { AwinMerchant } from "@/types/awin";

/**
 * Server action: given a URL the creator just pasted into Add Item, return
 * any active Awin merchant whose domain (or alt_domains) matches the URL's
 * host. The closet UI uses the result to show a "this brand is on Awin —
 * we'll wrap your click for tracking" hint on the preview step.
 *
 * Returns { merchant: null } for unrecognized hosts, invalid URLs, or any
 * lookup error — the auto-wrap hint is an enhancement, never a blocker.
 */
export async function findAwinMerchantForUrlAction(
  url: string,
): Promise<{ merchant: AwinMerchant | null }> {
  if (!url) return { merchant: null };
  try {
    const merchant = await findAwinMerchantForUrl(url);
    return { merchant };
  } catch {
    return { merchant: null };
  }
}
