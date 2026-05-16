import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/admin/auth";

/**
 * Admin-only proxy that calls the Supabase Edge Function `amazon-reports-sync`.
 *
 * Why a proxy and not a direct fetch from the client:
 *   - Service-role key never touches the browser.
 *   - Admin gate happens server-side via requireAdmin().
 *   - Single network shape on the client; if we ever swap the EF for an
 *     inline implementation we don't break the UI.
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason ?? "Forbidden" }, { status: 403 });
  }

  let body: { dry_run?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    /* allow empty */
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      {
        error: "config_missing",
        detail:
          "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.",
      },
      { status: 500 },
    );
  }

  try {
    const efRes = await fetch(`${supabaseUrl}/functions/v1/amazon-reports-sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dry_run: body.dry_run === true }),
      // EFs can take 20-60s when downloading large reports.
      signal: AbortSignal.timeout(75_000),
    });

    const efBody = await efRes.json().catch(() => null);
    return NextResponse.json(efBody ?? { ok: false, error: "ef_no_body" }, {
      status: efRes.ok ? 200 : 502,
    });
  } catch (e) {
    return NextResponse.json(
      { error: "ef_call_failed", detail: (e as Error).message },
      { status: 502 },
    );
  }
}
