// Daily Rakuten product-feed sync — runs as a Vercel cron at 06:00 UTC.
//
// Connects to aftp.linksynergy.com over PLAIN FTP (port 21 — Rakuten's server
// doesn't support TLS), walks each MID folder under root, pulls the full
// catalog file (<MID>_<SID>_mp.txt.gz), parses pipe-delimited rows, and POSTs
// products in 3K-row chunks to the rakuten-import-products-once Supabase
// Edge Function. After all merchants are processed, marks any product not
// seen in this run as removed_at = now() (tombstone pass).
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

const CHUNK_SIZE = 3000;

interface SyncResult {
  mid: string;
  ok: boolean;
  sent?: number;
  seen?: number;
  error?: string;
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
        const r = await processMid(ftp, mid, serviceKey);
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

    return NextResponse.json({
      ok: results.every((r) => r.ok),
      sync_start: syncStart.toISOString(),
      sync_end: new Date().toISOString(),
      results,
      tombstoned,
    });
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
async function processMid(
  ftp: FtpClient,
  mid: string,
  serviceKey: string,
): Promise<SyncResult> {
  const filename = `${mid}_${RAKUTEN_FTP_SID}_mp.txt.gz`;
  const remotePath = `/${mid}/${filename}`;
  const tmpDir = path.join(os.tmpdir(), "rakuten-feed-sync");
  await mkdir(tmpDir, { recursive: true });
  const localPath = path.join(tmpDir, filename);

  // Confirm file exists + size
  let fileInfo;
  try {
    const entries = await ftp.list(`/${mid}`);
    fileInfo = entries.find((e) => e.name === filename);
  } catch (e) {
    return { mid, ok: false, error: `list_failed: ${(e as Error).message}` };
  }
  if (!fileInfo) {
    return { mid, ok: false, error: "file_not_found" };
  }
  log(`  MID ${mid}: ${filename} (${(fileInfo.size ?? 0).toLocaleString()} bytes)`);

  // Download
  try {
    await ftp.downloadTo(localPath, remotePath);
  } catch (e) {
    return { mid, ok: false, error: `download_failed: ${(e as Error).message}` };
  }

  // Stream-parse + chunk + POST
  const rl = createInterface({
    input: createReadStream(localPath).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let headers: string[] | null = null;
  let separator = "|";
  const buffer: Record<string, unknown>[] = [];
  let totalSent = 0;
  let totalSeen = 0;

  for await (const line of rl) {
    if (!line.trim() || line.startsWith("Trailer Record")) continue;
    if (!headers) {
      separator = detectSeparator(line);
      headers = line.split(separator).map((h) => h.trim().toLowerCase());
      continue;
    }
    totalSeen++;
    const product = mapRow(headers, line.split(separator));
    if (!product) continue;
    buffer.push(product);

    if (buffer.length >= CHUNK_SIZE) {
      const sent = await postChunk(mid, buffer.splice(0), filename, serviceKey);
      totalSent += sent;
    }
  }
  if (buffer.length > 0) {
    totalSent += await postChunk(mid, buffer, filename, serviceKey);
  }

  try { await unlink(localPath); } catch { /* */ }

  log(`  ✓ MID ${mid}: ${totalSent.toLocaleString()} products upserted`);
  return { mid, ok: true, sent: totalSent, seen: totalSeen };
}

function detectSeparator(headerLine: string): string {
  return headerLine.split("\t").length > headerLine.split("|").length ? "\t" : "|";
}

function toNumber(v: string | undefined): number | null {
  if (!v) return null;
  const m = String(v).match(/(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
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

async function postChunk(
  rakutenMid: string,
  products: Record<string, unknown>[],
  sftpFilename: string,
  serviceKey: string,
): Promise<number> {
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/rakuten-import-products-once`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        rakuten_mid: rakutenMid,
        products,
        full_feed: false,            // tombstone happens once at the end, not per chunk
        sftp_filename: sftpFilename,
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EF ${res.status}: ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { inserted_or_updated?: number; inserted?: number };
  return json.inserted_or_updated ?? json.inserted ?? products.length;
}
