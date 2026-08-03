/**
 * GET /api/jobs — aggregated multi-source Manhattan bartender feed.
 *
 * Cache: 30 min in-memory (per lambda instance). `?force=1` bypasses it.
 * Response: { ok, fetchedAt, sources: {name,count,ok}[], jobs: JobPosting[] }.
 */

import { getJobs } from "@/src/lib/jobs/aggregate";
import type { JobsResponse } from "@/src/lib/jobs/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const force = new URL(req.url).searchParams.get("force") === "1";
  try {
    const result = await getJobs({ force });
    const body: JobsResponse = { ok: true, ...result };
    return Response.json(body);
  } catch (err) {
    const body: JobsResponse = {
      ok: false,
      fetchedAt: new Date().toISOString(),
      sources: [],
      jobs: [],
    };
    console.error("[/api/jobs]", err);
    return Response.json(body, { status: 500 });
  }
}
