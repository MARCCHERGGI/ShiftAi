import { NextRequest, NextResponse } from "next/server";
import { evaluateAnswer } from "@/src/lib/agents";

export async function POST(req: NextRequest) {
  try {
    const { question, answer, jobContext, venueContext } = await req.json();

    if (!question || !answer) {
      return NextResponse.json(
        { error: "Missing question or answer" },
        { status: 400 }
      );
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
