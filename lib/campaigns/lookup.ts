"use server";

import { findActiveCampaignForAsin } from "./queries";
import { extractAsin, isAmazonHost } from "@/lib/closet/asin";
import type { Campaign } from "@/types/campaigns";

/**
 * Server action: given a (possibly-Amazon) URL, return any active campaign
 * that includes the URL's ASIN. Used by the closet add flow to surface a
 * "this is in a +X% campaign" banner.
 *
 * Returns null for non-Amazon URLs, a.co/amzn.to short links (ASIN not
 * extractable until backend resolves), or unrecognized URLs.
 */
export async function findCampaignForUrlAction(
  url: string,
): Promise<{ campaign: Campaign | null }> {
  if (!url || !isAmazonHost(url)) return { campaign: null };
  const asin = extractAsin(url);
  if (!asin) return { campaign: null };
  try {
    const campaign = await findActiveCampaignForAsin(asin);
    return { campaign };
  } catch {
    // Fail silently — it's an enhancement banner, shouldn't break the form
    return { campaign: null };
  }
}
