"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

  // 1. Invite gate — call the SECURITY DEFINER consume function. Returns
  // false if no invite or already used. We do NOT mark used yet — defer
  // until signup actually succeeds, in case Supabase rejects (e.g. already
  // registered). For Phase 1A simplicity we just check existence first.
  const admin = createAdminClient();
  const { data: invite, error: inviteErr } = await admin
    .from("creator_web_invites")
    .select("id, used_at")
    .ilike("email", email)
    .maybeSingle();

  if (inviteErr) {
    return {
      error: "Could not verify your invite. Try again or contact support.",
      notice: null,
    };
  }
  if (!invite) {
    return {
      error:
        "We couldn't find an invite for that email. Reach out to support@styledinmotion.app for access.",
      notice: null,
    };
  }
  if (invite.used_at) {
    return {
      error:
        "That invite has already been used. Try signing in instead, or use forgot password.",
      notice: null,
    };
  }

  // 2. Create the auth user with creator metadata. The DB trigger
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
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://studio.styledinmotion.studio"}/auth/confirm`,
    },
  });

  if (error) {
    return { error: error.message, notice: null };
  }

  // 3. Mark the invite consumed.
  await admin
    .from("creator_web_invites")
    .update({ used_at: new Date().toISOString() })
    .eq("id", invite.id);

  // 4. If Supabase has email confirmation enabled, the user won't have a
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
