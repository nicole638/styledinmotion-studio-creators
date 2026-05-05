import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export const metadata = { title: "Create look" };

export default function NewLookPage() {
  return (
    <div className="max-w-2xl">
      <Link
        href="/looks"
        className="inline-flex items-center gap-1 text-sm text-muted hover:text-text mb-4"
      >
        <ChevronLeft size={14} strokeWidth={2} /> Looks
      </Link>

      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Phase 1C — Batch 2
      </p>
      <h1 className="font-display text-4xl">Composer ships next.</h1>
      <p className="mt-3 text-muted leading-relaxed">
        The look composer (cover photo upload, multi-select pieces from your
        closet, caption, save draft / publish) lands in the next push.
        Batch 1 (this list view + drafts/archived tabs) is live now.
      </p>
      <div className="mt-10 bg-card border border-border rounded-2xl p-6">
        <p className="text-sm text-muted">
          Until composer ships on web, use the iOS app to publish a new
          look — drafts saved on iOS will show up here under the Drafts tab.
        </p>
        <Link
          href="/looks"
          className="inline-flex items-center mt-5 text-rose underline underline-offset-2"
        >
          Back to looks
        </Link>
      </div>
    </div>
  );
}
