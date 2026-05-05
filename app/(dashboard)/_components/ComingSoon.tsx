import Link from "next/link";

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Coming soon
      </p>
      <h1 className="font-display text-4xl">{title}</h1>
      <p className="mt-3 text-muted leading-relaxed">{description}</p>
      <div className="mt-10 bg-card border border-border rounded-2xl p-6">
        <p className="text-sm text-muted">
          We're shipping this in phases. Phase 1A (the foundation
          you're seeing right now) goes live first; this surface
          opens up in the next phase. In the meantime, the iOS app
          has full functionality if you need to publish today.
        </p>
        <Link
          href="/"
          className="inline-flex items-center mt-5 text-rose underline underline-offset-2"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}
