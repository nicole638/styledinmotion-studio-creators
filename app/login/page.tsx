import Link from "next/link";
import LoginForm from "./LoginForm";

export const metadata = { title: "Sign in" };

type PageProps = {
  searchParams: { redirectTo?: string; reset?: string };
};

export default function LoginPage({ searchParams }: PageProps) {
  const redirectTo = searchParams.redirectTo ?? "/";
  // ?reset=ok comes from /auth/reset on a successful password change.
  // We surface it here so the user knows the new password is live.
  const resetOk = searchParams.reset === "ok";

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
