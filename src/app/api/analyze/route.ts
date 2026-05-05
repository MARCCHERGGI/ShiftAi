import { NextRequest, NextResponse } from "next/server";
import {
  analyzeJob,
  researchVenue,
  analyzeLocation,
  generateQuestions,
} from "@/src/lib/agents";
import { cachedOrCompute, hashInput } from "@/src/lib/cache";
import { enforceLimit, rateLimitResponse } from "@/src/lib/ratelimit";

export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceLimit(req, "analyze");
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const { listing } = await req.json();

    if (!listing?.trim()) {
      return NextResponse.json({ error: "No listing provided" }, { status: 400 });
    }
    if (listing.length > 10_000) {
      return NextResponse.json(
        { error: "Listing too long (max 10,000 characters)." },
        { status: 413 }
      );
    }

    const cacheKey = `analyze:${hashInput(listing.trim().toLowerCase())}`;

    const { value, hit } = await cachedOrCompute(
      cacheKey,
      async () => {
        const job = await analyzeJob(listing);
        const [venue, location] = await Promise.all([
          researchVenue(job.restaurant, job.location),
          analyzeLocation(job.location, job.restaurant),
        ]);
        const questions = await generateQuestions(job, venue);
        return {
          id: crypto.randomUUID(),
          rawListing: listing,
          job,
          venue,
          location,
          questions,
          createdAt: new Date().toISOString(),
        };
      },
      60 * 60 * 24
    );

    return NextResponse.json(value, {
      headers: {
        "x-cache": hit ? "HIT" : "MISS",
        "cache-control": "private, no-store",
      },
    });
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
