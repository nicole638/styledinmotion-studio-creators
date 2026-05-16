"use client";

import { useState, useTransition } from "react";
import { ArrowUpRight, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Admin trigger for the amazon-reports-sync Edge Function.
 *
 * Why this lives next to the CSV uploader: we're in transition. The CSV
 * upload is the path that has actual data in it today; the Creators API
 * Reports pipeline is the future once Amazon starts generating reports
 * for our account. Both write to the same `commissions` table; both are
 * idempotent on the (filename, md5) or (subtag uuid) key respectively.
 *
 * The button shows the raw EF response in a collapsed block so we can
 * see what Amazon's report shape looks like the first time a real
 * report lands (the EF stashes `header` + `row_count` per report in the
 * response).
 */
type SyncResult = {
  ok: boolean;
  new_reports?: number;
  parsed_rows?: number;
  ingested_rows?: number;
  reports?: Array<{
    filename: string;
    md5?: string;
    header?: string[];
    row_count?: number;
    delimiter_detected?: string;
    status?: string;
    error?: string;
    commissions_error?: string;
    ingested?: number;
  }>;
  note?: string;
  error?: string;
  detail?: string;
};

export function AmazonApiSync() {
  const [result, setResult] = useState<SyncResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const runSync = (dryRun: boolean) => {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/amazon/sync-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dry_run: dryRun }),
        });
        const body = (await r.json()) as SyncResult;
        setResult(body);
      } catch (e) {
        setResult({
          ok: false,
          error: "network_error",
          detail: (e as Error).message,
        });
      }
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-xs uppercase tracking-widest text-rose mb-1">
          Creators API Reports
        </p>
        <h2 className="font-display text-2xl">Auto-sync from Amazon.</h2>
        <p className="mt-2 text-sm text-muted leading-relaxed">
          Pulls commission reports directly from the Amazon Creators API
          (no CSV download required). Auth + pagination + dedup are
          handled by the{" "}
          <code className="text-xs font-mono text-text">
            amazon-reports-sync
          </code>{" "}
          edge function. Run on demand; once data starts flowing reliably
          we can put it on a daily cron.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => runSync(false)}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          <RefreshCw
            size={14}
            strokeWidth={2}
            className={isPending ? "animate-spin" : ""}
          />
          {isPending ? "Syncing…" : "Sync now"}
        </button>
        <button
          type="button"
          onClick={() => runSync(true)}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-bg px-5 py-2 text-sm hover:border-rose disabled:opacity-60 transition-colors"
        >
          Dry run (inspect only)
        </button>
      </div>

      {result ? (
        <div
          className={`rounded-xl border p-4 text-sm leading-relaxed ${
            result.ok && result.error == null
              ? "border-border bg-bg"
              : "border-rose/40 bg-rose/5"
          }`}
        >
          <div className="flex items-start gap-3">
            {result.ok && result.error == null ? (
              <CheckCircle2
                size={18}
                strokeWidth={1.75}
                className="shrink-0 mt-0.5 text-rose"
              />
            ) : (
              <AlertCircle
                size={18}
                strokeWidth={1.75}
                className="shrink-0 mt-0.5 text-rose"
              />
            )}
            <div className="min-w-0 flex-1">
              {result.ok && result.error == null ? (
                <>
                  <p className="font-medium">
                    {result.new_reports === 0
                      ? "No new reports."
                      : `${result.new_reports} new report${result.new_reports === 1 ? "" : "s"} processed.`}
                  </p>
                  {result.note ? (
                    <p className="mt-1 text-xs text-muted">{result.note}</p>
                  ) : null}
                  {result.parsed_rows != null ? (
                    <p className="mt-2 text-xs text-muted">
                      Parsed {result.parsed_rows} row
                      {result.parsed_rows === 1 ? "" : "s"} · Ingested{" "}
                      {result.ingested_rows ?? 0} into{" "}
                      <code className="font-mono">commissions</code>
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <p className="font-medium">{result.error ?? "Failed"}</p>
                  {result.detail ? (
                    <p className="mt-1 text-xs text-muted font-mono break-all">
                      {result.detail}
                    </p>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {result.reports && result.reports.length > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs uppercase tracking-widest text-muted hover:text-text">
                Per-report details
              </summary>
              <div className="mt-3 space-y-3 text-xs">
                {result.reports.map((r, i) => (
                  <div
                    key={`${r.filename}-${i}`}
                    className="rounded-lg border border-border bg-card p-3"
                  >
                    <p className="font-mono break-all">{r.filename}</p>
                    {r.row_count != null ? (
                      <p className="mt-1 text-muted">
                        {r.row_count} row{r.row_count === 1 ? "" : "s"} ·{" "}
                        {r.delimiter_detected ?? "?"}-separated
                      </p>
                    ) : null}
                    {r.header && r.header.length > 0 ? (
                      <p className="mt-2 text-muted">
                        <span className="uppercase tracking-widest text-[10px]">
                          Header columns:
                        </span>{" "}
                        <code className="font-mono">
                          {r.header.join(" · ")}
                        </code>
                      </p>
                    ) : null}
                    {r.ingested != null ? (
                      <p className="mt-1 text-rose">
                        Ingested {r.ingested} commission row
                        {r.ingested === 1 ? "" : "s"}
                      </p>
                    ) : null}
                    {r.error || r.commissions_error ? (
                      <p className="mt-1 text-rose">
                        {r.error ?? r.commissions_error}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}

      <p className="text-xs text-muted">
        First-run heads up: Amazon may return zero reports until the account
        has cycled through its first commission window. The EF stores raw
        header + sample rows in <code className="font-mono">amazon_report_runs</code>{" "}
        the first time a real report lands, so we can tune the column-
        mapping once we see the actual format.
      </p>
    </div>
  );
}
