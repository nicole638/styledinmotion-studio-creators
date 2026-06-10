"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { consignEligibility } from "@/lib/consignment/eligibility";

export interface SubmitConsignmentResult {
  ok: boolean;
  error?: string;
  requestId?: string;
  payoutMinUsd?: number | null;
  payoutMaxUsd?: number | null;
}

export interface SubmitConsignmentInput {
  itemId: string;
  /**
   * Required true: creator explicitly confirmed they physically own this
   * item. Because closet items can be pulled from the brand catalog (=
   * styled but not actually owned), the modal MUST present a checkbox
   * and the server MUST refuse submission unless this is true.
   */
  ownsItem: boolean;
}

/**
 * Submit a consignment request for one of the creator's closet items.
 *
 * Gates (v2):
 *   - Item belongs to caller (RLS enforces; explicit check for clean error)
 *   - Item.brand passes the TRR-accepted brand list (server-side check
 *     via creator_items.trr_eligible, computed by trigger)
 *   - Creator confirmed ownership (`ownsItem === true`) — required because
 *     items in the closet can be pulled from brand catalog and don't
 *     imply physical ownership
 *
 * Snapshots item metadata + payout estimate into consignment_requests
 * and emails nicole@styledinmotion.app so she sees requests land live.
 */
export async function submitConsignmentRequestAction(
  input: SubmitConsignmentInput,
): Promise<SubmitConsignmentResult> {
  const { itemId, ownsItem } = input;
  if (!itemId?.trim()) {
    return { ok: false, error: "Missing item id." };
  }
  if (!ownsItem) {
    return {
      ok: false,
      error:
        "Please confirm you own this item before consigning. " +
        "Items pulled from a brand catalog can't be consigned through TRR.",
    };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  // Load the item and confirm it's the caller's. RLS would block a
  // cross-creator read, but checking explicitly gives a friendlier error.
  const { data: item, error: itemErr } = await supabase
    .from("creator_items")
    .select("id, creator_id, name, brand, photo_url, price, category, url, trr_eligible")
    .eq("id", itemId)
    .maybeSingle();

  if (itemErr) return { ok: false, error: itemErr.message };
  if (!item) return { ok: false, error: "Item not found." };
  if (item.creator_id !== user.id) {
    return { ok: false, error: "This isn't your item to consign." };
  }

  // Server-side re-check of brand eligibility (trigger keeps this column
  // in sync with the trr_accepted_brands list).
  if (!item.trr_eligible) {
    return {
      ok: false,
      error:
        "TheRealReal isn't currently accepting this brand for consignment. " +
        "If you think that's a mistake, email support@styledinmotion.app.",
    };
  }

  // Compute payout estimate (price-only — brand gate already passed).
  const elig = consignEligibility(true, item.category, item.price);

  const { data: inserted, error: insErr } = await supabase
    .from("consignment_requests")
    .insert({
      creator_id: user.id,
      item_id: itemId,
      partner: "therealreal",
      status: "submitted",
      item_name: item.name,
      item_brand: item.brand,
      item_photo_url: item.photo_url,
      item_price: item.price,
      payout_min_usd: elig.payoutMinUsd,
      payout_max_usd: elig.payoutMaxUsd,
      creator_confirmed_owns: true,
    })
    .select("id")
    .single();

  if (insErr) return { ok: false, error: insErr.message };

  // Fire the notification email out-of-band. Failure here MUST NOT
  // surface to the creator — the submission already landed in the DB.
  // Best-effort: catch + log.
  void notifyConsignmentRequest({
    requestId: inserted.id,
    creatorEmail: user.email ?? "(unknown creator)",
    itemName: item.name ?? "Untitled item",
    itemBrand: item.brand ?? "Unknown brand",
    itemPriceText: item.price ?? "—",
    itemPhotoUrl: item.photo_url,
    payoutMinUsd: elig.payoutMinUsd,
    payoutMaxUsd: elig.payoutMaxUsd,
  });

  revalidatePath("/closet");
  revalidatePath(`/closet/${itemId}`);

  return {
    ok: true,
    requestId: inserted.id,
    payoutMinUsd: elig.payoutMinUsd,
    payoutMaxUsd: elig.payoutMaxUsd,
  };
}

/**
 * Send a notification email to nicole@styledinmotion.app via Resend's
 * HTTP API. Reads RESEND_API_KEY from Vercel env. If the key is missing
 * we log + skip — never block the consignment submission itself.
 */
async function notifyConsignmentRequest(params: {
  requestId: string;
  creatorEmail: string;
  itemName: string;
  itemBrand: string;
  itemPriceText: string;
  itemPhotoUrl: string | null;
  payoutMinUsd: number | null;
  payoutMaxUsd: number | null;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(
      "[consignment] RESEND_API_KEY not set — skipping notify email",
    );
    return;
  }

  const subject = `Consignment request: ${params.itemBrand} ${params.itemName}`;
  const payoutLine =
    params.payoutMinUsd != null && params.payoutMaxUsd != null
      ? `$${params.payoutMinUsd.toFixed(0)} – $${params.payoutMaxUsd.toFixed(0)}`
      : "—";

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#F7F4F0;">
      <div style="text-align:center;margin-bottom:24px;">
        <p style="color:#B87063;font-size:11px;letter-spacing:2px;margin:0;">CONSIGNMENT REQUEST</p>
        <h1 style="color:#1A1210;font-size:22px;font-weight:700;margin:6px 0 0;">A creator wants to consign.</h1>
      </div>
      <div style="background:#FFFFFF;border-radius:12px;padding:24px;border:1px solid #E8E0D8;">
        ${
          params.itemPhotoUrl
            ? `<img src="${params.itemPhotoUrl}" alt="${params.itemBrand}" style="width:100%;max-width:200px;border-radius:8px;display:block;margin:0 auto 16px;" />`
            : ""
        }
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#1A1210;">
          <tr><td style="padding:6px 0;color:#6B5E58;width:40%;">Creator</td><td style="padding:6px 0;">${params.creatorEmail}</td></tr>
          <tr><td style="padding:6px 0;color:#6B5E58;">Brand</td><td style="padding:6px 0;">${params.itemBrand}</td></tr>
          <tr><td style="padding:6px 0;color:#6B5E58;">Item</td><td style="padding:6px 0;">${params.itemName}</td></tr>
          <tr><td style="padding:6px 0;color:#6B5E58;">Retail</td><td style="padding:6px 0;">${params.itemPriceText}</td></tr>
          <tr><td style="padding:6px 0;color:#6B5E58;">Est. payout</td><td style="padding:6px 0;font-weight:600;color:#B87063;">${payoutLine}</td></tr>
        </table>
        <p style="color:#6B5E58;font-size:12px;margin:20px 0 0;">Request ID: ${params.requestId}</p>
      </div>
      <p style="text-align:center;color:#6B5E58;font-size:11px;margin-top:20px;">Styled in Motion → The RealReal pipeline</p>
    </div>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: "Styled in Motion <noreply@styledinmotion.app>",
        to: ["nicole@styledinmotion.app"],
        subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        "[consignment] resend non-2xx:",
        res.status,
        text.slice(0, 200),
      );
    }
  } catch (e) {
    console.warn("[consignment] notify email failed:", e);
  }
}

/**
 * Lookup whether a given closet item already has a pending consignment
 * request, so the card can show "Consigning ✓" instead of the active
 * "Consign" pill after the creator submits.
 */
export async function listOpenConsignmentItemIds(): Promise<Set<string>> {
  const supabase = createAdminClient();
  // We want the calling creator's open consignment requests. From a
  // server component we can use the regular createClient which respects
  // RLS, but the admin path is fine since we filter by item_id anyway.
  const user = await createClient().auth.getUser();
  const creatorId = user.data.user?.id;
  if (!creatorId) return new Set();

  const { data, error } = await supabase
    .from("consignment_requests")
    .select("item_id")
    .eq("creator_id", creatorId)
    .in("status", ["submitted", "accepted", "authenticated", "listed"]);

  if (error) {
    console.warn(
      "[consignment] listOpen failed:",
      error.message,
    );
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.item_id));
}
