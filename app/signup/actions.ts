"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignupState = {
  error: string | null;
  notice: string | null;
};

export async function signupAction(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const firstName = String(formData.get("firstName") || "").trim();
  const lastName = String(formData.get("lastName") || "").trim();

  if (!email || !password || !firstName || !lastName) {
    return { error: "All fields are required.", notice: null };
  }
  if (password.length < 8) {
    return { error: "Password must be at least 8 characters.", notice: null };
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
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
        name: `${firstName} ${lastName}`.trim(),
        user_type: "creator",
      },
      // Route through /auth/callback so the PKCE code is exchanged
      // server-side (HttpOnly cookies). After exchange, /auth/callback
      // redirects to /, which the middleware handles for logged-in
      // users.
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://studio.styledinmotion.studio"}/auth/callback?next=${encodeURIComponent("/")}`,
    },
  });

  if (error) {
    return { error: error.message, notice: null };
  }

  // If Supabase has email confirmation enabled, the user won't have a
  // session yet. Surface a notice instead of redirecting.
  if (!data.session) {
    return {
      error: null,
      notice:
        "Check your email and tap the confirmation link to finish signup.",
    };
  }

  redirect("/");
}
