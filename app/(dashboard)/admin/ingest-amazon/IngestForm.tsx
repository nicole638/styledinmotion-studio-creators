"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import {
  ingestAmazonReportAction,
  type IngestSummary,
} from "@/lib/earnings/mutations";

export function IngestForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [result, setResult] = useState<IngestSummary | null>(null);
  const [busy, startBusy] = useTransition();

  const handleFile = async (file: File) => {
    setFilename(file.name);
    const text = await file.text();
    setCsvText(text);
    setResult(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvText.trim()) return;
    setResult(null);
    startBusy(async () => {
      const r = await ingestAmazonReportAction(csvText);
      setResult(r);
    });
  };

  const handleClear = () => {
    setCsvText("");
    setFilename(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* File picker */}
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm hover:border-rose disabled:opacity-60 transition-colors"
        >
          <Upload size={14} strokeWidth={2} />
          Pick CSV
        </button>
        {filename ? (
          <span className="ml-3 inline-flex items-center gap-1 text-xs text-muted">
            <FileText size={12} strokeWidth={2} />
            {filename} · {(csvText.length / 1024).toFixed(1)} KB
          </span>
        ) : null}
      </div>

      {/* OR paste */}
      <div>
        <label className="block text-xs uppercase tracking-widest text-muted mb-1.5">
          Or paste CSV contents
        </label>
        <textarea
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setFilename(null);
            setResult(null);
          }}
          rows={6}
          placeholder="Date,Order ID,ASIN,Title,Tracking ID,SubTag,Price,Earnings,Status..."
          className="w-full rounded-2xl border border-border bg-card px-4 py-2.5 text-xs font-mono outline-none focus:border-rose resize-y"
        />
      </div>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy || !csvText.trim()}
          className="inline-flex items-center gap-2 rounded-full bg-rose text-white px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {busy ? "Ingesting…" : "Ingest report"}
        </button>
        {csvText ? (
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="text-sm text-muted hover:text-text"
          >
            Clear
          </button>
        ) : null}
      </div>

      {/* Result */}
      {result ? <ResultPanel result={result} /> : null}
    </form>
  );
}

function ResultPanel({ result }: { result: IngestSummary }) {
  const ok = result.ok;
  return (
    <div
      className={`mt-4 rounded-2xl border p-4 ${
        ok
          ? "bg-card border-border"
          : "bg-[#FBE9E5] border-[#F4C7BF]"
      }`}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 size={16} strokeWidth={2} className="text-rose" />
        ) : (
          <AlertCircle size={16} strokeWidth={2} className="text-[#B53D2A]" />
        )}
        <h3 className="font-display text-lg">
          {ok ? "Report ingested" : "Ingestion blocked"}
        </h3>
      </div>

      {result.error ? (
        <p className="mt-2 text-sm text-[#B53D2A]">{result.error}</p>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <Stat label="Parsed rows" value={result.parsedRows} />
        <Stat
          label="Skipped during parse"
          value={result.skippedDuringParse}
        />
        <Stat label="Matched click events" value={result.matched} />
        <Stat label="Unmatched clicks" value={result.unmatchedClick} />
        <Stat label="Inserted commissions" value={result.inserted} />
        <Stat
          label="Total commission $"
          value={`$${result.totalCommissionUsd.toFixed(2)}`}
        />
      </dl>

      {Object.keys(result.headerMap).length > 0 ? (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-muted">
            Header mapping ({Object.keys(result.headerMap).length} cols
            recognized)
          </summary>
          <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted">
            {Object.entries(result.headerMap).map(([raw, mapped]) => (
              <li key={raw}>
                {raw} → <span className="text-text">{mapped}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {result.skipExamples.length > 0 ? (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-muted">
            Skipped / unmatched examples ({result.skipExamples.length})
          </summary>
          <ul className="mt-2 space-y-2 text-[11px]">
            {result.skipExamples.map((ex, i) => (
              <li key={i} className="font-mono leading-snug">
                <span className="text-[#B53D2A]">{ex.reason}</span>
                <pre className="mt-1 text-muted whitespace-pre-wrap">
                  {JSON.stringify(ex.row, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </>
  );
}
