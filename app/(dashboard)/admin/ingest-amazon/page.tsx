import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { IngestForm } from "./IngestForm";
import { AmazonApiSync } from "./AmazonApiSync";

export const metadata = { title: "Ingest Amazon report" };

export default async function IngestAmazonPage() {
  if (!(await isAdmin())) redirect("/");

  return (
    <div className="max-w-3xl">
      <p className="text-xs uppercase tracking-[0.25em] text-rose mb-3">
        Admin · Amazon ingestion
      </p>
      <h1 className="font-display text-4xl">Upload an Amazon report.</h1>
      <p className="mt-3 text-muted leading-relaxed max-w-prose">
        Paste or upload a CSV from Amazon Associates. The parser auto-detects
        the SubTag column (we accept "SubTag", "ascsubtag", "Tracking ID
        Sub", and a few other names Amazon ships) and matches each row's
        subtag UUID back to a <span className="font-mono text-xs">click_events</span>{" "}
        row to attribute the sale to a creator + look + item.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed">
        <p className="text-xs uppercase tracking-widest text-rose mb-2">
          Reports that work
        </p>
        <p className="text-muted">
          Use the <strong>Orders Report</strong> (or "By SubTag" tab if your
          account has it). The aggregate Earnings, Tracking ID, and Linked
          Product reports don't include subtag — they'll error out here with
          a helpful message.
        </p>
        <p className="text-muted mt-2">
          Idempotent: re-uploading the same report updates existing
          commissions rows rather than duplicating. Pending sales upgrade to
          confirmed when Amazon confirms.
        </p>
      </div>

      <div className="mt-10 editorial-divider" />

      {/* New: Creators API auto-sync — preferred path once Amazon starts
          generating reports for us. The CSV uploader below stays as the
          fallback for historical reports + manual ops. */}
      <div className="mt-8">
        <AmazonApiSync />
      </div>

      <div className="mt-10 editorial-divider" />

      <div className="mt-8">
        <p className="text-xs uppercase tracking-widest text-muted mb-2">
          Manual fallback
        </p>
        <IngestForm />
      </div>
    </div>
  );
}
