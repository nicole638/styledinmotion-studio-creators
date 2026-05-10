"use server";

import { createClient } from "@/lib/supabase/server";

export type ForgotState = {
  error: string | null;
  notice: string | null;
};

export async function forgotPasswordAction(
  _prev: ForgotState,
  formData: FormData,
): Promise<ForgotState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Enter your email.", notice: null };

  const supabase = createClient();
  // The PKCE flow (default for @supabase/ssr) stores the code verifier
  // as an HttpOnly cookie. Browser JS can't read those, so we route the
  // email link through /auth/callback (server route handler) which
  // exchanges the code, sets the session, then redirects to /auth/reset
  // where the user picks a new password.
  //
  // Both /auth/callback and /auth/reset must be on the allowed-redirect-
  // URLs list in Supabase (Auth → URL Configuration).
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://styledinmotion-studio-creators.vercel.app";
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent("/auth/reset")}`,
  });

  if (error) {
    return { error: error.message, notice: null };
  }

  return {
    error: null,
    notice:
      "If an account exists for that email, we just sent a reset link. Check your inbox.",
  };
}
