"use client";

import { useFormState, useFormStatus } from "react-dom";
import { signupAction, type SignupState } from "./actions";

const initialState: SignupState = { error: null, notice: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
    >
      {pending ? "Creating account…" : "Create account"}
    </button>
  );
}

export default function SignupForm() {
  const [state, formAction] = useFormState(signupAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
            First name
          </label>
          <input
            name="firstName"
            type="text"
            autoComplete="given-name"
            required
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
            Last name
          </label>
          <input
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
          Email
        </label>
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
        />
      </div>
      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
          Password
        </label>
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
        />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
      </div>

      {state.error ? (
        <div
          role="alert"
          className="text-sm text-[#B53D2A] bg-[#FBE9E5] border border-[#F4C7BF] rounded-2xl px-4 py-3"
        >
          {state.error}
        </div>
      ) : null}
      {state.notice ? (
        <div
          role="status"
          className="text-sm text-text bg-card border border-border rounded-2xl px-4 py-3"
        >
          {state.notice}
        </div>
      ) : null}

      <SubmitButton />
    </form>
  );
}
