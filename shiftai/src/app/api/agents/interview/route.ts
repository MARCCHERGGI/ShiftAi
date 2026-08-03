/**
 * POST /api/agents/interview — stateless mock-interview turn.
 * Body: InterviewRequest → InterviewResponse (see src/lib/agents/types.ts).
 */

import { interviewTurn } from "@/src/lib/interview/engine";
import type { InterviewRequest, InterviewResponse, InterviewTurn } from "@/src/lib/agents/types";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: InterviewResponse, status = 200): Response {
  return Response.json(body, { status });
}

function normalizeHistory(v: unknown): InterviewTurn[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter(
      (t): t is InterviewTurn =>
        !!t &&
        typeof t === "object" &&
        typeof (t as InterviewTurn).question === "string" &&
        typeof (t as InterviewTurn).answer === "string",
    )
    .map((t) => ({
      question: t.question,
      answer: t.answer,
      score: typeof t.score === "number" && Number.isFinite(t.score) ? t.score : 0,
      feedback: typeof t.feedback === "string" ? t.feedback : "",
    }));
}

export async function POST(req: Request): Promise<Response> {
  let body: Partial<InterviewRequest>;
  try {
    body = (await req.json()) as Partial<InterviewRequest>;
  } catch {
    return json({ ok: false, total: 6, done: false, error: "Invalid JSON body" }, 400);
  }

  const request: InterviewRequest = {
    profile: body.profile ?? null,
    analysis: body.analysis ?? null,
    history: normalizeHistory(body.history),
    pendingQuestion: typeof body.pendingQuestion === "string" ? body.pendingQuestion : null,
    answer: typeof body.answer === "string" ? body.answer : null,
  };

  try {
    const res = await interviewTurn(request);
    return json(res);
  } catch (err) {
    console.error("[interview] turn failed:", err);
    const message = err instanceof Error ? err.message : "Interview turn failed";
    return json({ ok: false, total: 6, done: false, error: message }, 500);
  }
}
