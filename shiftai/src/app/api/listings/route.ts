/**
 * GET /api/listings — returns latest verified Craigslist Manhattan
 * food/beverage/hospitality listings.
 *
 * Cache: 1h in-memory. First call after a cold start triggers a scrape
 * (15-30s). Subsequent calls are instant until TTL expires.
 *
 * Optional ?refresh=1 with admin token forces a fresh scrape.
 */

import { getCachedListings, getCacheMeta } from "@/src/lib/craigslist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("refresh") === "1";
  const adminToken = process.env.ADMIN_TOKEN;
  const provided =
    req.headers.get("x-admin-token") || url.searchParams.get("token") || "";

  // gate forced refresh behind admin token to prevent scraper-DoS
  const allowForce = force && adminToken && provided === adminToken;

  try {
    const meta = getCacheMeta();
    const result = await getCachedListings({ force: !!allowForce });
    return Response.json({
      ok: true,
      cacheHit: meta.hasCache && !allowForce,
      ageMs: meta.ageMs === Infinity ? null : meta.ageMs,
      ...result,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
