import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

type PageProps = {
  searchParams: { redirectTo?: string; reset?: string; authError?: string };
};

export default function LoginPage({ searchParams }: PageProps) {
  const redirectTo = searchParams.redirectTo ?? "/";
  // ?reset=ok comes from /auth/reset on a successful password change.
  const resetOk = searchParams.reset === "ok";
  // ?authError=... comes from /auth/callback when an email link is
  // dead, expired, or already consumed.
  const authError = searchParams.authError ?? null;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
            Studio
          </p>
          <h1 className="font-display text-4xl">Welcome back.</h1>
          <p className="mt-3 text-sm text-muted">
            Sign in to manage your closet and looks.
          </p>
        </div>

        {resetOk ? (
          <div
            role="status"
            className="mb-4 text-sm text-text bg-card border border-border rounded-2xl px-4 py-3"
          >
            Password updated. Sign in with your new password.
          </div>
        ) : null}

        {authError ? (
          <div
            role="alert"
            className="mb-4 text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3"
          >
            {authError}
          </div>
        ) : null}

        <LoginForm redirectTo={redirectTo} />

        <div className="mt-8 text-center text-sm text-muted space-y-2">
          <div>
            <Link
              href="/forgot-password"
              className="underline underline-offset-2 hover:text-rose transition-colors"
            >
              Forgot your password?
            </Link>
          </div>
          <div>
            New here?{" "}
            <Link
              href="/signup"
              className="text-rose underline underline-offset-2"
            >
              Create a creator account
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
