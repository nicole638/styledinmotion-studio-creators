"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { signupAction, type SignupState } from "./actions";

// Fire-and-forget signup funnel beacon. Never throws, never blocks signup.
function logSignupEvent(payload: Record<string, unknown>) {
  try {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!base) return;
    void fetch(`${base}/functions/v1/log-signup-event`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(key ? { apikey: key, authorization: `Bearer ${key}` } : {}),
      },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

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
  const [sessionId] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );

  // Age gate (16+). `max` softly prevents picking a too-recent date; the server
  // action re-checks authoritatively.
  const maxDob = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 16);
    return d.toISOString().slice(0, 10);
  })[0];

  useEffect(() => {
    logSignupEvent({ event: "page_view", surface: "creator", source: "web", session_id: sessionId });
  }, [sessionId]);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="sessionId" value={sessionId} />
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
          Date of birth
        </label>
        <input
          name="birthDate"
          type="date"
          required
          max={maxDob}
          className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm outline-none focus:border-rose"
        />
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

      <div className="flex items-start gap-2">
        <input
          id="agree"
          name="agree"
          type="checkbox"
          required
          className="mt-1 accent-rose"
        />
        <label htmlFor="agree" className="text-xs text-muted leading-relaxed">
          I agree to the{" "}
          <a
            href="https://shop.styledinmotion.studio/creator-agreement"
            target="_blank"
            rel="noreferrer"
            className="text-rose underline"
          >
            Creator Agreement
          </a>{" "}
          and{" "}
          <a
            href="https://shop.styledinmotion.studio/terms"
            target="_blank"
            rel="noreferrer"
            className="text-rose underline"
          >
            Terms
          </a>
          .
        </label>
      </div>

      <SubmitButton />
    </form>
  );
}
