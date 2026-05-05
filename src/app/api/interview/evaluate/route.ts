import { NextRequest, NextResponse } from "next/server";
import { evaluateAnswer } from "@/src/lib/agents";
import { enforceLimit, rateLimitResponse } from "@/src/lib/ratelimit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const rl = await enforceLimit(req, "interview");
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const { question, answer, jobContext, venueContext } = await req.json();

    if (!question || !answer) {
      return NextResponse.json({ error: "Missing question or answer" }, { status: 400 });
    }
    if (String(answer).length > 3000) {
      return NextResponse.json({ error: "Answer too long (max 3,000 chars)." }, { status: 413 });
    }

    const evaluation = await evaluateAnswer(
      question,
      answer,
      jobContext || "Bartender position",
      venueContext || "Restaurant/bar"
    );

    return NextResponse.json(evaluation);
  } catch (error: unknown) {
    console.error("Evaluation error:", error);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
