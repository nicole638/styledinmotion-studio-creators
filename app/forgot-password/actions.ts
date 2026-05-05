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
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://studio.styledinmotion.studio"}/auth/confirm`,
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
