import Link from "next/link";
import ForgotForm from "./ForgotForm";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
            Studio
          </p>
          <h1 className="font-display text-4xl">Reset your password.</h1>
          <p className="mt-3 text-sm text-muted">
            Enter your email — we'll send a reset link if your account
            exists.
          </p>
        </div>

        <ForgotForm />

        <div className="mt-8 text-center text-sm text-muted">
          <Link href="/login" className="text-rose underline underline-offset-2">
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
