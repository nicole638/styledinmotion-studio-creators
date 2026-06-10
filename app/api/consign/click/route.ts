import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * /api/consign/click — beacon endpoint for the Consign modal's "Drop off
 * on The RealReal directly" CTA.
 *
 * The modal calls navigator.sendBeacon() before the new tab opens, so:
 *   - we have ~50ms before the browser kills the request
 *   - the user's signed-in cookie is attached automatically
 *   - we never block the navigation
 *
 * Body shape (from ConsignmentModal.tsx):
 *   { surface, destination, item_id, affiliate_network }
 *
 * We log to click_events with affiliate_network='trr_partnership' so it
 * shows up in /admin/click-analytics alongside Awin/Rakuten/CJ. The TRR
 * attribution model is server-side on their LP — they'll periodically
 * return a unique-identifier feed of conversions which we'll reconcile
 * against this beacon log.
 */
export async function POST(request: Request) {
  // sendBeacon sends application/json or text/plain depending on the
  // Blob type. Either way we just want the JSON.
  let body: {
    surface?: string;
    destination?: string;
    item_id?: string;
    affiliate_network?: string;
  } = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    // sendBeacon body parse error — log and bail, don't 500
    return new NextResponse(null, { status: 204 });
  }

  const supabase = createClient();

  // Get the signed-in creator from the session cookie. If absent, this is
  // probably a shopper or a logged-out tap — still log it for volume.
  let creatorId: string | null = null;
  try {
    const { data } = await supabase.auth.getUser();
    creatorId = data?.user?.id ?? null;
  } catch {
    /* no session — anonymous click */
  }

  const ua = request.headers.get("user-agent") ?? null;
  const ref = request.headers.get("referer") ?? null;

  try {
    await supabase.from("click_events").insert({
      creator_id: creatorId,
      affiliate_network: body.affiliate_network ?? "trr_partnership",
      redirect_url: body.destination ?? null,
      source_surface: body.surface ?? "consign_modal",
      item_id: body.item_id ?? null,
      user_agent: ua,
      referrer_url: ref,
    });
  } catch (err) {
    console.warn("[/api/consign/click] insert failed:", err);
  }

  // sendBeacon doesn't care about the response body — return 204 fast.
  return new NextResponse(null, { status: 204 });
}
