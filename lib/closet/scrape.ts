/**
 * Wrapper around the existing backend productInfo route at
 *   GET /api/product-info?url=<encoded>
 * which lives at process.env.NEXT_PUBLIC_BACKEND_URL.
 *
 * The backend handles a.co short URL pre-resolution, ScrapingBee
 * fallbacks, and merchant-image caching to Supabase Storage. We just
 * proxy the response into our ClosetItem shape.
 */
export interface ScrapedProduct {
  name: string | null;
  brand: string | null;
  price: string | null;
  imageUrl: string | null;
  originalImageUrl: string | null;
  description: string | null;
  canonicalUrl: string | null;
  source: string;
}

export class ScrapeError extends Error {
  status: number;
  detail: string | null;
  constructor(message: string, status: number, detail: string | null = null) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// Default backend origin so the closet bulk fetch works even when the
// Vercel project hasn't had the env var set yet. Override via
// NEXT_PUBLIC_BACKEND_URL (e.g. for staging or a self-hosted backend).
const DEFAULT_BACKEND_URL = "https://meadow-grindstone.vibecode.run";

export async function fetchProductInfo(url: string): Promise<ScrapedProduct> {
  const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? DEFAULT_BACKEND_URL;

  const apiUrl = `${baseUrl.replace(/\/$/, "")}/api/product-info?url=${encodeURIComponent(url)}`;
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      headers: { Accept: "application/json" },
      // 25s — ScrapingBee can take a while on harder sites.
      signal: AbortSignal.timeout(25000),
    });
  } catch (e: any) {
    throw new ScrapeError("Network error", 0, e?.message ?? "fetch failed");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ScrapeError(
      `Backend returned ${res.status}`,
      res.status,
      body.slice(0, 300),
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ScrapeError("Bad response", res.status, "non-JSON body");
  }

  return {
    name: data.name ?? null,
    brand: data.brand ?? data.siteName ?? null,
    price: data.price ?? null,
    imageUrl: data.imageUrl ?? null,
    originalImageUrl: data.originalImageUrl ?? null,
    description: data.description ?? null,
    canonicalUrl: data.canonicalUrl ?? null,
    source: data._source ?? "unknown",
  };
}
