/**
 * GET /api/jobs/refresh — force-refreshes the aggregated jobs cache.
 * Vercel cron target (07:00 New York, see vercel.json). Idempotent and cheap
 * (a handful of public-page fetches, zero LLM calls) — intentionally unprotected.
 */

import { getJobs } from "@/src/lib/jobs/aggregate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  try {
    const result = await getJobs({ force: true });
    return Response.json({
      ok: true,
      fetchedAt: result.fetchedAt,
      sources: result.sources,
      total: result.jobs.length,
    });
  } catch (err) {
    console.error("[/api/jobs/refresh]", err);
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
