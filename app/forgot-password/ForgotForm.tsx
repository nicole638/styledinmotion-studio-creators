"use client";

import { useFormState, useFormStatus } from "react-dom";
import { forgotPasswordAction, type ForgotState } from "./actions";

const initialState: ForgotState = { error: null, notice: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full inline-flex items-center justify-center rounded-full bg-rose text-white px-5 py-3 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60"
    >
      {pending ? "Sending…" : "Send reset link"}
    </button>
  );
}

export default function ForgotForm() {
  const [state, formAction] = useFormState(forgotPasswordAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
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
