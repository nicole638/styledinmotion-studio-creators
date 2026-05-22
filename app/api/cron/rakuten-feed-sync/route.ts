// Daily Rakuten product-feed sync — runs as a Vercel cron at 06:00 UTC.
//
// Connects to aftp.linksynergy.com over PLAIN FTP (port 21 — Rakuten's server
// doesn't support TLS), walks each MID folder under root, finds the merchant's
// snapshot files (<MID>_<SID>_<CATEGORY>_cmp.txt.gz for category-segmented
// merchants like Bloomingdale's, or <MID>_<SID>_mp.txt.gz for single-catalog
// merchants), parses pipe-delimited positional rows, and upserts products
// directly into rakuten_products via the Supabase service-role client.
// Chunks of 500 rows are submitted with up to 3 concurrent upserts in flight —
// sized to stay under Supabase's Postgres statement_timeout on the big
// merchants (Bloomingdale's, COUTR). After all merchants are processed, marks any
// product not seen in this run as removed_at = now() (tombstone pass).
//
// Vercel cron auth: requires CRON_SECRET env var; Vercel sends the request
// with `Authorization: Bearer <CRON_SECRET>`. We reject other callers.
//
// Required env vars (set in Vercel project settings):
//   RAKUTEN_FTP_USER             rkp_4705911
//   RAKUTEN_FTP_PASS             (25-char Rakuten password)
//   SUPABASE_SERVICE_ROLE_KEY    (already set on this project)
//   CRON_SECRET                  (random string — also set in dashboard cron config)
//
// Hard-coded:
//   RAKUTEN_FTP_HOST = aftp.linksynergy.com
//   RAKUTEN_FTP_SID  = 4705911
//   SUPABASE_URL     = https://rghlcnrttvlvphzahudf.supabase.co
//
// Manual trigger: GET /api/cron/rakuten-feed-sync?mid=13867 to sync one merchant.
// Authorization header must include `Bearer ${CRON_SECRET}` either way.

import { NextRequest, NextResponse } from "next/server";
import { Client as FtpClient } from "basic-ftp";
import { createClient } from "@supabase/supabase-js";
import { createReadStream } from "node:fs";
import { mkdir, unlink } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";
import path from "node:path";
import os from "node:os";

export const runtime = "nodejs";   // basic-ftp needs Node.js (not Edge)
export const maxDuration = 300;    // 5 minutes — Vercel Pro tier ceiling

const RAKUTEN_FTP_HOST = "aftp.linksynergy.com";
const RAKUTEN_FTP_SID = "4705911";
const SUPABASE_URL = "https://rghlcnrttvlvphzahudf.supabase.co";

const CHUNK_SIZE = 500;        // smaller chunks dodge Supabase statement_timeout on large merchants (Bloomingdale's, COUTR)
const UPSERT_CONCURRENCY = 3;  // 3 chunks in flight at once — was 6, dropped to keep Postgres happy

// Category filtering — values are matched case-insensitively against col[3] (Primary Category)
// of the first data row. Files whose primary category falls into SKIP_CATEGORIES are
// downloaded only to peek at the category, then aborted. Saves upsert time for irrelevant
// inventory like home goods.
const SKIP_CATEGORIES = new Set([
  "home", "home & garden", "home and garden", "kids", "kid", "baby", "babies",
  "furniture", "kitchen", "bedding", "bath", "garden", "outdoor",
]);

// Priority categories — we process these FIRST (in this order). Files not matching
// any priority category but not in SKIP_CATEGORIES still get processed, just after the
// priority ones.
const PRIORITY_CATEGORIES = [
  "clothing", "women", "apparel", "dress", "dresses",
  "handbag", "handbags", "bag", "bags",
  "shoe", "shoes", "boots", "sneakers",
  "beauty", "beauty & cosmetics", "cosmetics", "fragrance", "makeup",
  "accessories", "jewelry",
];

// Use a single Supabase client across the whole invocation.
// Typed loosely — generic inference between createClient call sites is brittle in TS 5.4.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

interface SyncResult {
  mid: string;
  ok: boolean;
  sent?: number;
  seen?: number;
  files_processed?: number;
  files_skipped?: string[];
  error?: string;
  folder_contents?: { name: string; size: number; type: string }[];
  // Diagnostic — surfaces actual file structure when sent=0
  diag?: {
    first_file?: string;
    separator?: string;
    hdr_record?: string[];
    sample_data_row?: { col_index: number; value: string }[];
    sample_row_count?: number;
    pid_hit_rate?: { with_pid: number; without_pid: number };
  };
}

function log(...args: unknown[]) {
  console.log(`[rakuten-feed-sync ${new Date().toISOString()}]`, ...args);
}

export async function GET(req: NextRequest) {
  // ── Auth ──
  const auth = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET ?? ""}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Required creds
  const ftpUser = process.env.RAKUTEN_FTP_USER;
  const ftpPass = process.env.RAKUTEN_FTP_PASS;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ftpUser || !ftpPass || !serviceKey) {
    return NextResponse.json(
      { error: "missing_env", missing: { ftpUser: !ftpUser, ftpPass: !ftpPass, serviceKey: !serviceKey } },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const midFilter = url.searchParams.get("mid")?.trim() || null;
  // ?files=N caps how many snapshot files we process per merchant — diagnostic / smoke-test knob.
  const filesCap = Number(url.searchParams.get("files") ?? "0") || null;

  const supa = createClient(SUPABASE_URL, serviceKey);
  const syncStart = new Date();
  const ftp = new FtpClient(90_000);     // bumped from 30s — first attempt timed out on control socket

  log("Starting sync", { midFilter, syncStart: syncStart.toISOString() });

  // Pre-flight: bare TCP probe to port 21 so we can distinguish
  // "TCP firewalled" (Vercel egress blocked) from "FTP protocol issue"
  // (TLS mismatch, slow banner, auth, etc.).
  try {
    const net = await import("node:net");
    const tcpProbe = await new Promise<{ ok: boolean; ms: number; err?: string }>((resolve) => {
      const t0 = Date.now();
      const sock = net.createConnection({ host: RAKUTEN_FTP_HOST, port: 21, timeout: 15_000 });
      sock.once("connect", () => {
        sock.destroy();
        resolve({ ok: true, ms: Date.now() - t0 });
      });
      sock.once("timeout", () => {
        sock.destroy();
        resolve({ ok: false, ms: Date.now() - t0, err: "tcp_timeout_15s" });
      });
      sock.once("error", (e: Error) => resolve({ ok: false, ms: Date.now() - t0, err: e.message }));
    });
    log(`TCP probe ${RAKUTEN_FTP_HOST}:21 →`, tcpProbe);
    if (!tcpProbe.ok) {
      return NextResponse.json(
        {
          error: "tcp_blocked",
          probe: tcpProbe,
          note: "Vercel egress (AWS Lambda iad1) can't reach Rakuten FTP on port 21 — IP-level block",
        },
        { status: 502 },
      );
    }
  } catch (e) {
    log("TCP probe threw:", (e as Error).message);
  }

  try {
    await ftp.access({
      host: RAKUTEN_FTP_HOST,
      user: ftpUser,
      password: ftpPass,
      secure: false,
      port: 21,
    });
    log("✓ FTP connected");

    // List root → numeric folder names are merchant MIDs
    const root = await ftp.list("/");
    let midFolders = root
      .filter((e) => e.isDirectory && /^\d+$/.test(e.name))
      .map((e) => e.name);
    if (midFilter) midFolders = midFolders.filter((m) => m === midFilter);

    log(`  ${midFolders.length} merchant folder(s) to process:`, midFolders);

    const results: SyncResult[] = [];
    for (const mid of midFolders) {
      try {
        const r = await processMid(ftp, mid, supa, filesCap);
        results.push(r);
      } catch (e) {
        log(`  ✗ MID ${mid} unrecoverable:`, (e as Error).message);
        results.push({ mid, ok: false, error: (e as Error).message });
      }
    }

    // ── Tombstone pass ──
    const success = results.filter((r) => r.ok);
    const tombstoned: Record<string, number> = {};
    for (const r of success) {
      const { data: merchant } = await supa
        .from("rakuten_merchants")
        .select("id")
        .eq("rakuten_mid", r.mid)
        .maybeSingle();
      if (!merchant) continue;
      const { count } = await supa
        .from("rakuten_products")
        .update({ removed_at: new Date().toISOString() }, { count: "exact" })
        .eq("merchant_id", merchant.id)
        .is("removed_at", null)
        .lt("last_seen_at", syncStart.toISOString());
      tombstoned[r.mid] = count ?? 0;
    }

    // Refresh the deduped catalog materialized view so iOS Brands tab sees
    // the latest products without size/color variant duplicates. Non-blocking
    // (CONCURRENTLY) — reads keep working during refresh. Failure here is
    // non-fatal; the matview just stays at the previous version until next run.
    try {
      await supa.rpc("refresh_affiliate_products");
      log("✓ affiliate_products matview refreshed");
    } catch (e) {
      log("affiliate_products refresh failed:", (e as Error).message);
    }

    const payload = {
      ok: results.every((r) => r.ok),
      sync_start: syncStart.toISOString(),
      sync_end: new Date().toISOString(),
      results,
      tombstoned,
    };
    // Persist full run record so we can inspect it later without keeping the HTTP
    // connection open. Curl times out after 42s but Vercel keeps running — we want
    // to capture what happened across the full execution window.
    try {
      await supa.from("rakuten_sync_runs").insert({
        started_at: syncStart.toISOString(),
        finished_at: payload.sync_end,
        ok: payload.ok,
        mid_filter: midFilter,
        files_cap: filesCap,
        result: payload,
      });
    } catch (e) {
      log("sync_runs insert failed:", (e as Error).message);
    }
    return NextResponse.json(payload);
  } catch (e) {
    log("✗ Fatal:", (e as Error).message);
    return NextResponse.json(
      { error: "fatal", detail: (e as Error).message },
      { status: 500 },
    );
  } finally {
    try { ftp.close(); } catch { /* ignore */ }
  }
}

// ── Per-MID processing ──────────────────────────────────────────────────────
// Rakuten delivers two file shapes:
//   1. Single full catalog:        <MID>_<SID>_mp.txt.gz
//   2. Per-category snapshots:     <MID>_<SID>_<CATEGORY>_cmp.txt.gz   (Bloomingdale's, etc.)
// Either way we want only the full snapshots, NOT the deltas:
//   skip *_cmp_delta.txt.gz, *_cmp_deltatemplate.txt.gz, *_mp_delta.txt.gz
async function processMid(
  ftp: FtpClient,
  mid: string,
  supa: Supa,
  filesCap: number | null = null,
): Promise<SyncResult> {
  // Pre-fetch merchant UUID (one DB roundtrip per merchant, not per chunk)
  const { data: merchant } = await supa
    .from("rakuten_merchants")
    .select("id")
    .eq("rakuten_mid", mid)
    .maybeSingle();
  if (!merchant) {
    return { mid, ok: false, error: "merchant_not_in_db" };
  }
  const merchantId = merchant.id as string;
  const tmpDir = path.join(os.tmpdir(), "rakuten-feed-sync");
  await mkdir(tmpDir, { recursive: true });

  // List folder, classify files
  let entries;
  let folderEntries: { name: string; size: number; type: string }[] = [];
  try {
    entries = await ftp.list(`/${mid}`);
    folderEntries = entries.map((e) => ({
      name: e.name,
      size: e.size ?? 0,
      type: e.isDirectory ? "dir" : e.isFile ? "file" : "other",
    }));
  } catch (e) {
    return { mid, ok: false, error: `list_failed: ${(e as Error).message}` };
  }

  // Build the snapshot file list.
  // Match: <MID>_<SID>_*_cmp.txt.gz (category snapshot)  OR  <MID>_<SID>_mp.txt.gz (full catalog)
  // Reject anything containing "delta" or "deltatemplate".
  const snapshotPattern = new RegExp(
    `^${mid}_${RAKUTEN_FTP_SID}_(\\d+_cmp|mp)\\.txt\\.gz$`,
    "i",
  );
  let snapshotFiles = entries
    .filter((e) => e.isFile && snapshotPattern.test(e.name) && !/delta/i.test(e.name))
    .sort((a, b) => a.name.localeCompare(b.name));
  if (filesCap && snapshotFiles.length > filesCap) {
    snapshotFiles = snapshotFiles.slice(0, filesCap);
  }

  if (snapshotFiles.length === 0) {
    return { mid, ok: false, error: "no_snapshot_files_found", folder_contents: folderEntries };
  }

  const totalBytes = snapshotFiles.reduce((s, f) => s + (f.size ?? 0), 0);
  log(`  MID ${mid}: ${snapshotFiles.length} snapshot file(s), ${totalBytes.toLocaleString()} bytes total`);

  let totalSent = 0;
  let totalSeen = 0;
  let filesProcessed = 0;
  const filesSkipped: string[] = [];
  let diag: SyncResult["diag"] = undefined;
  let pidHits = 0;
  let pidMisses = 0;

  for (const fileInfo of snapshotFiles) {
    const actualFilename = fileInfo.name;
    const remotePath = `/${mid}/${actualFilename}`;
    const localPath = path.join(tmpDir, actualFilename);

    // Download. If FTP dropped us between files, reconnect once and retry.
    let downloadOk = false;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await ftp.downloadTo(localPath, remotePath);
        downloadOk = true;
        break;
      } catch (e) {
        const msg = (e as Error).message;
        log(`    ! ${actualFilename}: download attempt ${attempt} failed — ${msg}`);
        if (attempt === 1) {
          // Try to recover by reconnecting (Rakuten often kicks long-lived sessions)
          try { ftp.close(); } catch { /* */ }
          try {
            await ftp.access({
              host: RAKUTEN_FTP_HOST,
              user: process.env.RAKUTEN_FTP_USER!,
              password: process.env.RAKUTEN_FTP_PASS!,
              secure: false,
              port: 21,
            });
            log(`    ↻ Reconnected FTP for ${actualFilename}`);
          } catch (re) {
            log(`    ✗ FTP reconnect failed: ${(re as Error).message}`);
            filesSkipped.push(`${actualFilename}: ${msg} (reconnect_failed: ${(re as Error).message})`);
            break;
          }
        } else {
          filesSkipped.push(`${actualFilename}: ${msg}`);
        }
      }
    }
    if (!downloadOk) continue;

    // Stream-parse + chunk + POST
    const rl = createInterface({
      input: createReadStream(localPath).pipe(createGunzip()),
      crlfDelay: Infinity,
    });

    let separator = "|";
    let hdrRecord: string[] | null = null;
    let fileCategory: string | null = null;
    let categorySkipped = false;
    const buffer: Record<string, unknown>[] = [];
    const inflight: Promise<unknown>[] = [];
    let fileSent = 0;
    let fileSeen = 0;

    for await (const line of rl) {
      if (!line.trim()) continue;
      if (categorySkipped) break;  // bail out fast once we know category is filtered

      // Rakuten cmp/mp files use HDR record at start + TRL record at end.
      // Both must be skipped — data rows are between them, positional, no column header row.
      const upper = line.slice(0, 4).toUpperCase();
      if (upper.startsWith("HDR")) {
        const sep = detectSeparator(line);
        const parts = line.split(sep);
        if (!hdrRecord) hdrRecord = parts;
        if (!diag) {
          separator = sep;
          diag = {
            first_file: actualFilename,
            separator: sep === "\t" ? "TAB" : sep,
            hdr_record: parts.slice(0, 10),
          };
        }
        continue;
      }
      if (upper.startsWith("TRL") || line.startsWith("Trailer Record")) {
        continue;
      }

      // Data row
      fileSeen++;
      const values = line.split(separator);

      // First data row → check category; if filtered, abort this file
      if (!fileCategory) {
        fileCategory = (values[3] ?? "").trim().toLowerCase();
        if (SKIP_CATEGORIES.has(fileCategory)) {
          log(`    ↷ ${actualFilename}: category "${fileCategory}" in skip list — aborting`);
          filesSkipped.push(`${actualFilename}: category_filtered=${fileCategory}`);
          categorySkipped = true;
          continue;
        }
        log(`    ▸ ${actualFilename}: category "${fileCategory}" — processing`);
      }

      // Snapshot first 3 data rows so we can see column positions
      if (diag && (diag.sample_row_count ?? 0) < 1) {
        const sample = values.slice(0, 50).map((v, i) => ({
          col_index: i,
          value: (v ?? "").slice(0, 120),
        }));
        diag.sample_data_row = sample;
        diag.sample_row_count = (diag.sample_row_count ?? 0) + 1;
      } else if (diag) {
        diag.sample_row_count = (diag.sample_row_count ?? 0) + 1;
      }

      const product = mapRowPositional(values);
      if (!product) {
        pidMisses++;
        continue;
      }
      pidHits++;
      buffer.push(product);

      if (buffer.length >= CHUNK_SIZE) {
        const chunk = buffer.splice(0);
        inflight.push(upsertChunk(supa, merchantId, chunk).then((n) => { fileSent += n; }));
        // Drain when we hit concurrency ceiling
        if (inflight.length >= UPSERT_CONCURRENCY) {
          await Promise.race(inflight);
          // Remove settled
          for (let i = inflight.length - 1; i >= 0; i--) {
            const p = inflight[i] as Promise<unknown> & { settled?: boolean };
            // We can't introspect settle state on stock Promise, so just await all when capped
          }
          await Promise.all(inflight.splice(0));
        }
      }
    }
    // Drain remaining (skip if we bailed on category filter)
    if (!categorySkipped) {
      if (buffer.length > 0) {
        inflight.push(upsertChunk(supa, merchantId, buffer.splice(0)).then((n) => { fileSent += n; }));
      }
      await Promise.all(inflight.splice(0));
    }

    try { await unlink(localPath); } catch { /* */ }

    if (categorySkipped) {
      // already counted in filesSkipped
    } else {
      log(`    ✓ ${actualFilename}: ${fileSent.toLocaleString()} upserted (${fileSeen.toLocaleString()} rows, cat=${fileCategory})`);
      totalSent += fileSent;
      totalSeen += fileSeen;
      filesProcessed++;
    }
  }

  log(`  ✓ MID ${mid}: ${totalSent.toLocaleString()} total products across ${filesProcessed} file(s)`);
  if (diag) diag.pid_hit_rate = { with_pid: pidHits, without_pid: pidMisses };
  return {
    mid,
    ok: filesProcessed > 0,
    sent: totalSent,
    seen: totalSeen,
    files_processed: filesProcessed,
    ...(filesSkipped.length > 0 ? { files_skipped: filesSkipped } : {}),
    ...(diag ? { diag } : {}),
  };
}

function detectSeparator(headerLine: string): string {
  return headerLine.split("\t").length > headerLine.split("|").length ? "\t" : "|";
}

function toNumber(v: string | undefined): number | null {
  if (!v) return null;
  const m = String(v).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}

// Rakuten Category Merchant Product (CMP) v2 positional schema.
// No column header row — fields are pipe-delimited and ordered:
//   0  Product ID (long offer ID, used as product_id_in_feed)
//   1  Product Name
//   2  Merchant SKU
//   3  Primary Category
//   4  Secondary Category
//   5  Buy URL (Rakuten-tracked click link)
//   6  Image URL
//   7  (reserved)
//   8  Short Description
//   9  Long Description
//   10 Discount
//   11 Discount Type
//   12 Sale Price
//   13 Retail Price
//   14 Begin Date
//   15 End Date
//   16 Brand
//   17 Shipping
//   18 Keywords
//   19 Manufacturer Part Number / EAN
//   20 Manufacturer Name
//   21 ISBN
//   22 Stock Availability ("in-stock" / "out-of-stock" / "unavailable")
//   23 UPC
//   24 Class ID
//   25 Currency
//   26 Offline (Y/N)
//   27 Impression pixel
//   28 Advertiser-internal ID
//   29 Full Category Path
//   30 Size
//   31 Material
//   32 Color
//   33 Gender
//   34 (reserved)
//   35 Age Range
function mapRowPositional(v: string[]): Record<string, unknown> | null {
  const get = (i: number) => (v[i] ?? "").trim();
  const pid = get(0);
  if (!pid) return null;

  const imageUrl = get(6);
  const stock = get(22).toLowerCase();
  const inStock = stock ? stock === "in-stock" || stock === "instock" : true;

  const product: Record<string, unknown> = {
    product_id_in_feed: pid,
    sku: get(2) || pid,
    name: get(1) || null,
    description: get(8) || get(9) || null,
    brand: get(20) || get(16) || null,
    category: get(3) || null,
    merchant_category: get(4) || null,
    price: toNumber(get(13)),
    search_price: toNumber(get(12)) || toNumber(get(13)),
    rrp_price: toNumber(get(13)),
    currency: (get(25) || "USD").slice(0, 8),
    in_stock: inStock,
    product_url: get(5) || null,
    rakuten_deep_link: get(5) || null,
    image_urls: imageUrl ? [imageUrl] : [],
  };

  // Strip empty optional fields (keep image_urls + in_stock + product_id_in_feed)
  for (const k of Object.keys(product)) {
    if (k === "image_urls" || k === "in_stock" || k === "product_id_in_feed") continue;
    const val = product[k];
    if (val === null || val === undefined || val === "") delete product[k];
  }
  return product;
}

function mapRow(
  headers: string[],
  values: string[],
): Record<string, unknown> | null {
  const get = (key: string) => {
    const idx = headers.indexOf(key);
    return idx >= 0 ? (values[idx] ?? "").trim() : "";
  };
  const pid = get("sku") || get("skuid") || get("product id");
  if (!pid) return null;

  const offline = get("offline");
  const imageUrl = get("image url") || get("image");

  const product: Record<string, unknown> = {
    product_id_in_feed: pid,
    sku: pid,
    name: get("product name") || null,
    description: get("long description") || get("short description") || null,
    brand: get("manufacturer name") || get("brand") || null,
    category: get("primary category") || null,
    merchant_category: get("secondary category") || null,
    price: toNumber(get("retail price") || get("price")),
    search_price: toNumber(get("sale price")),
    rrp_price: toNumber(get("original price")),
    currency: (get("currency") || "USD").slice(0, 8),
    in_stock: offline ? offline !== "Y" : true,
    product_url: get("product url") || null,
    rakuten_deep_link: get("buy url") || get("buy link") || null,
    image_urls: imageUrl ? [imageUrl] : [],
  };

  // Strip empty optional fields to keep payload small
  for (const k of Object.keys(product)) {
    if (k === "image_urls") continue;
    const v = product[k];
    if (v === null || v === undefined || v === "") delete product[k];
  }
  return product;
}

// Direct upsert via Supabase service-role client (skips the Edge Function middleman).
// Sets last_seen_at = now() and clears removed_at on conflict so tombstoned products
// that come back in the feed reactivate automatically.
async function upsertChunk(
  supa: Supa,
  merchantId: string,
  products: Record<string, unknown>[],
): Promise<number> {
  if (products.length === 0) return 0;
  const nowIso = new Date().toISOString();
  const rows = products.map((p) => ({
    ...p,
    merchant_id: merchantId,
    last_seen_at: nowIso,
    removed_at: null,
  }));
  const { error } = await supa
    .from("rakuten_products")
    .upsert(rows, {
      onConflict: "merchant_id,product_id_in_feed",
      ignoreDuplicates: false,
    });
  if (error) {
    throw new Error(`upsert failed (${rows.length} rows): ${error.message}`);
  }
  return rows.length;
}
