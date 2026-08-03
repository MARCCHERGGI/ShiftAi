import { NextRequest, NextResponse } from "next/server";
import {
  analyzeJob,
  researchVenue,
  analyzeLocation,
  generateQuestions,
} from "@/src/lib/agents";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { listing } = await req.json();

    if (!listing?.trim()) {
      return NextResponse.json(
        { error: "No listing provided" },
        { status: 400 }
      );
    }

    // Agent 1: Parse and analyze the job listing
    const job = await analyzeJob(listing);

    // Agents 2 & 3: Research venue + location in parallel
    const [venue, location] = await Promise.all([
      researchVenue(job.restaurant, job.location),
      analyzeLocation(job.location, job.restaurant),
    ]);

    // Agent 4: Generate targeted interview questions
    const questions = await generateQuestions(job, venue);

    return NextResponse.json({
      id: crypto.randomUUID(),
      rawListing: listing,
      job,
      venue,
      location,
      questions,
      createdAt: new Date().toISOString(),
    });
  } catch (error: unknown) {
    console.error("Analysis error:", error);
    const message =
      error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
