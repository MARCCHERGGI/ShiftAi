import { NextRequest, NextResponse } from "next/server";
import { enhanceResume } from "@/src/lib/agents";
import { enforceLimit, rateLimitResponse } from "@/src/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceLimit(req, "resume");
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const { userInfo, job, venue } = await req.json();

    if (!userInfo || !job || !venue) {
      return NextResponse.json({ error: "Missing required data" }, { status: 400 });
    }

    const enhanced = await enhanceResume(userInfo, job, venue);
    return NextResponse.json(enhanced);
  } catch (error: unknown) {
    console.error("Enhancement error:", error);
    return NextResponse.json({ error: "Enhancement failed" }, { status: 500 });
  }
}
