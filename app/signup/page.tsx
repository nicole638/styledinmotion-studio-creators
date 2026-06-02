import Link from "next/link";
import SignupForm from "./SignupForm";

export const metadata = { title: "Create your creator account" };

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
            Studio
          </p>
          <h1 className="font-display text-4xl">Become a creator.</h1>
          <p className="mt-3 text-sm text-muted">
            Style your closet, share your looks, and earn every time a
            shopper buys what you styled. Free to join — no invite needed.
          </p>
        </div>

        <SignupForm />

        <div className="mt-8 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-rose underline underline-offset-2">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
