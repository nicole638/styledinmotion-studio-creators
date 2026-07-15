"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = {
  error: string | null;
  notice: string | null;
};

// Age gate — must be 16+ to create an account (Apple UGC / under-13 rule),
// mirroring the iOS app (mobile/src/lib/age.ts). Whole years old for an ISO
// yyyy-mm-dd birth date, or null if the date is malformed/future.
const MIN_SIGNUP_AGE = 16;
function computeAge(birthDateISO: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDateISO);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  const now = new Date();
  if (dt.getTime() > now.getTime()) return null;
  let age = now.getUTCFullYear() - y;
  if (now.getUTCMonth() + 1 < mo || (now.getUTCMonth() + 1 === mo && now.getUTCDate() < d)) age -= 1;
  return age;
}

// Fire the signup funnel beacon (page_view is sent from the client;
// attempt/success/error are sent here so they carry the real outcome).
// Wrapped so telemetry can never block or fail a signup.
async function logSignupEvent(payload: Record<string, unknown>) {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!base) return;
    await fetch(`${base}/functions/v1/log-signup-event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { apikey: key, authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify({ source: "web", surface: "creator", ...payload }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    /* never block signup on telemetry */
  }
}

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();
  const sessionId = String(formData.get("sessionId") || "");
  const birthDate = String(formData.get("birthDate") || "").trim();
  const agreed = formData.get("agree") === "on";

  if (!email || !password || !firstName || !lastName) {
    return { error: "All fields are required.", notice: null };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", notice: null };
  }
  const age = computeAge(birthDate);
  if (age === null) {
    return { error: "Please enter your date of birth.", notice: null };
  }
  if (age < MIN_SIGNUP_AGE) {
    return { error: `You must be at least ${MIN_SIGNUP_AGE} to create an account.`, notice: null };
  }
  if (!agreed) {
    return {
      error: "Please accept the Creator Agreement and Terms to continue.",
      notice: null,
    };
  }

  // Open creator signup — iOS has no invite gate and beta data showed the
  // web gate had 0% successful conversions across 17 issues. Anyone with
  // an email can self-sign-up. If quality moderation is needed later,
  // add a creator_profiles.is_pending_review flag rather than re-gating.
  //
  // The web invite check used to live here (removed 2026-06-02). The
  // creator_web_invites table is left in place — it's a no-op now and can
  // be dropped in a later cleanup migration.

  // Create the auth user with creator metadata. The DB trigger
  // handle_new_user_signup creates the matching creators + creator_profiles
  // rows. We pass first/last name + user_type='creator' in metadata.
  const supabase = createClient();
  await logSignupEvent({ event: "attempt", email, session_id: sessionId });
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        user_type: "creator",
        birth_date: birthDate,
        // Creator Agreement acceptance — the handle_new_user_signup trigger
        // records this into creator_agreement_acceptances (current version).
        agreement_accepted: true,
        agreement_version: "v1",
        agreement_source: "web",
      },
      // Route through /auth/callback so the PKCE code is exchanged
      // server-side (HttpOnly cookies). After exchange, /auth/callback
      // redirects to /, which the middleware handles for logged-in
      // users.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://studio.styledinmotion.studio"}/auth/callback?next=${encodeURIComponent("/")}`,
    },
  });

  if (error) {
    await logSignupEvent({ event: "error", email, session_id: sessionId, error_code: error.message });
    return { error: error.message, notice: null };
  }

  // If Supabase has email confirmation enabled, the user won't have a
  // session yet. Surface a notice instead of redirecting.
  if (!data.session) {
    await logSignupEvent({ event: "success", email, session_id: sessionId });
    return {
      error: null,
      notice:
        "Check your email and tap the confirmation link to finish signup.",
    };
  }

  await logSignupEvent({ event: "success", email, session_id: sessionId });
  redirect("/");
}
