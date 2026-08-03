/**
 * Mock-interview engine. Stateless per call: the client carries history.
 * Exactly 6 questions. With venue analysis the mix is:
 *   q1 venue-specific icebreaker · q2 menu/cocktail knowledge ·
 *   q3 review-derived service scenario · q4 conflict behavioral ·
 *   q5 high-volume rush behavioral · q6 "why this venue".
 * Without analysis: 6 strong generic bartender questions.
 * Questions are deterministic for a given (profile, analysis) so the
 * sequence stays stable across stateless calls.
 */

import { runStructuredExtract } from "@/src/lib/llm";
import type {
  AnalyzeResult,
  InterviewRequest,
  InterviewResponse,
  InterviewTurn,
  Profile,
} from "@/src/lib/agents/types";

const TOTAL = 6;

/* ── question construction ───────────────────────── */

const GENERIC_QUESTIONS: string[] = [
  "Tell me about your path behind the bar so far — where you've worked, and what kind of bartender you've become.",
  "Walk me through a cocktail you love to make: the spec, the build order, and how you'd sell it to a guest who says they \"don't know what they want.\"",
  "A guest flags you down: their drink took fifteen minutes and it's wrong. The bar is full. Walk me through exactly what you do and say.",
  "Tell me about a time you had to cut someone off or handle an aggressive, intoxicated guest. How did you keep them safe without losing the room?",
  "Describe the single busiest shift you've ever worked. What was your system for keeping tickets, the service well, and your own guests all moving at once?",
  "Last one: why this bar? What kind of room do you want to work, and what would you bring to it that we don't already have?",
];

function lcFirst(s: string): string {
  const t = s.trim().replace(/[.。]+$/, "");
  return t ? t.charAt(0).toLowerCase() + t.slice(1) : t;
}

function buildQuestions(analysis: AnalyzeResult | null): string[] {
  if (!analysis) return [...GENERIC_QUESTIONS];

  const venueName = analysis.venue?.name ?? analysis.job.venueName ?? null;
  const kind = analysis.venue?.kind ?? null;
  const neighborhood = analysis.venue?.neighborhood ?? analysis.job.neighborhood ?? null;
  const menu = analysis.menu;
  const reviews = analysis.reviews;

  const questions = [...GENERIC_QUESTIONS];

  // q1 — venue-specific icebreaker
  if (venueName) {
    questions[0] =
      `Thanks for coming in to ${venueName}` +
      (neighborhood ? ` here in ${neighborhood}` : "") +
      `. To start: what do you already know about us` +
      (kind ? ` — we run a ${lcFirst(kind)} —` : "") +
      ` and what's your read on the kind of room we're going for?`;
  }

  // q2 — menu / cocktail knowledge
  if (menu?.cocktails?.length) {
    const named = menu.cocktails.slice(0, 2).join(" and ");
    questions[1] = `You've seen our list — drinks like ${named}. How would you guide a first-time guest through a menu like ours, and what does that list tell you about how we build drinks here?`;
  } else if (menu?.spiritsFocus) {
    questions[1] = `Our program is ${lcFirst(menu.spiritsFocus)}. What's your depth there — bottles you reach for, specs you know cold, and how you'd talk a hesitant guest into exploring it?`;
  } else if (menu?.signatureItems?.length) {
    questions[1] = `Guests come here for things like ${menu.signatureItems.slice(0, 2).join(" and ")}. How do you pair drinks with a food-forward menu, and what would you push from behind the bar?`;
  }

  // q3 — review-derived service scenario
  const complaint = reviews?.complaints?.[0] ?? reviews?.serviceNotes?.[0] ?? null;
  if (complaint) {
    questions[2] = `Our reviews occasionally mention ${lcFirst(complaint)}. It's a packed Saturday and you can see exactly that starting to happen at your bar. What do you do, step by step?`;
  } else if (reviews?.praise?.length) {
    questions[2] = `Guests consistently praise ${lcFirst(reviews.praise[0])} here. How do you personally deliver that in hour nine of a slammed shift?`;
  }

  // q4, q5 stay as the classic behaviorals (conflict, high-volume rush).

  // q6 — why this venue
  if (venueName) {
    questions[5] = `Last one: why ${venueName}, specifically? What would you add to this bar that isn't already here?`;
  }

  return questions;
}

/* ── scoring ─────────────────────────────────────── */

const SCORE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 10 },
    feedback: { type: "string", description: "2-3 concrete sentences" },
  },
  required: ["score", "feedback"],
};

const SUMMARY_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", description: "One-sentence hiring read" },
    tips: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
  },
  required: ["verdict", "tips"],
};

function clampScore(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : 0;
  return Math.max(0, Math.min(10, v));
}

function venueContextBlock(analysis: AnalyzeResult | null): string {
  if (!analysis) return "No venue research available — score venue awareness leniently.";
  const parts: string[] = [];
  const venueName = analysis.venue?.name ?? analysis.job.venueName;
  if (venueName) parts.push(`Venue: ${venueName}`);
  if (analysis.venue?.kind) parts.push(`Kind: ${analysis.venue.kind}`);
  if (analysis.venue?.vibe) parts.push(`Vibe: ${analysis.venue.vibe}`);
  if (analysis.menu?.spiritsFocus) parts.push(`Spirits focus: ${analysis.menu.spiritsFocus}`);
  if (analysis.menu?.cocktails?.length) {
    parts.push(`Signature cocktails: ${analysis.menu.cocktails.slice(0, 4).join(", ")}`);
  }
  if (analysis.reviews?.serviceNotes?.length) {
    parts.push(`What reviewers say about staff: ${analysis.reviews.serviceNotes.slice(0, 3).join("; ")}`);
  }
  return parts.length ? parts.join("\n") : "Venue could not be identified.";
}

async function scoreAnswer(
  question: string,
  answer: string,
  profile: Profile | null,
  analysis: AnalyzeResult | null,
): Promise<{ score: number; feedback: string }> {
  const systemPrompt = [
    "You are a veteran NYC bar manager scoring one mock-interview answer from a bartender candidate.",
    "",
    "Rubric (weigh all three):",
    "1. SPECIFICITY — real details: named drinks, specs, numbers, actual situations. Vague generalities score low.",
    "2. HOSPITALITY MINDSET — guest-first instincts, composure, ownership of problems, reading the room.",
    "3. VENUE AWARENESS — does the answer show they understand THIS venue (when venue context is given)?",
    "",
    "Calibration — be honest, not kind:",
    "- 9-10: vivid, specific, guest-first; you would hire off this answer alone.",
    "- 7-8: strong and specific with a minor gap.",
    "- 5-6: adequate but generic — could have been said about any bar.",
    "- 3-4: thin, vague, or misses the point of the question.",
    "- 0-2: empty, off-topic, or a red flag (blames guests, safety ignorance).",
    "",
    "feedback: 2-3 sentences, concrete. Name the single strongest thing in the answer, then the sharpest specific improvement. No praise padding.",
    "",
    "VENUE CONTEXT:",
    venueContextBlock(analysis),
  ].join("\n");

  const userPrompt = JSON.stringify({
    question,
    answer,
    candidate: profile
      ? { role: profile.role, yearsExperience: profile.yearsExperience, skills: profile.skills }
      : null,
  });

  const raw = await runStructuredExtract<{ score?: unknown; feedback?: unknown }>({
    systemPrompt,
    userPrompt,
    schema: SCORE_SCHEMA,
    maxTokens: 512,
  });

  return {
    score: clampScore(raw.score),
    feedback:
      typeof raw.feedback === "string" && raw.feedback.trim()
        ? raw.feedback.trim()
        : "No feedback generated — the answer was scored on specificity, hospitality mindset, and venue awareness.",
  };
}

async function buildSummary(
  turns: InterviewTurn[],
  analysis: AnalyzeResult | null,
): Promise<{ overallScore: number; verdict: string; tips: string[] }> {
  const overallScore =
    Math.round(
      (turns.reduce((sum, t) => sum + clampScore(t.score), 0) / Math.max(1, turns.length)) * 10,
    ) / 10;

  const systemPrompt = [
    "You are a veteran NYC bar manager wrapping up a 6-question mock interview with a bartender candidate.",
    "You are given the full transcript with per-answer scores (0-10).",
    "Return an honest one-sentence verdict (a hiring read, e.g. 'Strong hire signal — specific and guest-first, needs sharper venue prep')",
    "and EXACTLY 3 tips: the three highest-leverage, concrete things to fix before the real interview.",
    "Each tip is one sentence, actionable tonight, grounded in what they actually said. No generic advice.",
    "",
    "VENUE CONTEXT:",
    venueContextBlock(analysis),
  ].join("\n");

  const userPrompt = JSON.stringify({ transcript: turns, averageScore: overallScore });

  try {
    const raw = await runStructuredExtract<{ verdict?: unknown; tips?: unknown }>({
      systemPrompt,
      userPrompt,
      schema: SUMMARY_SCHEMA,
      maxTokens: 512,
    });
    const tips = Array.isArray(raw.tips)
      ? raw.tips.filter((t): t is string => typeof t === "string" && !!t.trim()).slice(0, 3)
      : [];
    while (tips.length < 3) {
      tips.push(
        [
          "Add one named drink, number, or real shift story to every answer — specificity is what separates you.",
          "Lead every scenario answer with what the guest experiences, then your mechanics.",
          "Research the venue's menu and reviews the night before and reference them by name.",
        ][tips.length],
      );
    }
    return {
      overallScore,
      verdict:
        typeof raw.verdict === "string" && raw.verdict.trim()
          ? raw.verdict.trim()
          : `Averaged ${overallScore}/10 across six answers.`,
      tips,
    };
  } catch {
    return {
      overallScore,
      verdict: `Averaged ${overallScore}/10 across six answers.`,
      tips: [
        "Add one named drink, number, or real shift story to every answer — specificity is what separates you.",
        "Lead every scenario answer with what the guest experiences, then your mechanics.",
        "Research the venue's menu and reviews the night before and reference them by name.",
      ],
    };
  }
}

/* ── the turn engine ─────────────────────────────── */

export async function interviewTurn(req: InterviewRequest): Promise<InterviewResponse> {
  const questions = buildQuestions(req.analysis);
  const history = Array.isArray(req.history) ? req.history : [];
  const answered = history.length;

  // No answer submitted → hand out the next unanswered question (or wrap up
  // a session that somehow already completed).
  if (req.answer == null || req.pendingQuestion == null) {
    if (answered >= TOTAL) {
      const summary = await buildSummary(history.slice(0, TOTAL), req.analysis);
      return { ok: true, total: TOTAL, done: true, summary };
    }
    return { ok: true, question: questions[answered], total: TOTAL, done: false };
  }

  // Score the submitted answer.
  const scored = await scoreAnswer(req.pendingQuestion, req.answer, req.profile, req.analysis);
  const completed = answered + 1;

  if (completed >= TOTAL) {
    const turns: InterviewTurn[] = [
      ...history,
      { question: req.pendingQuestion, answer: req.answer, ...scored },
    ].slice(0, TOTAL);
    const summary = await buildSummary(turns, req.analysis);
    return { ok: true, scored, total: TOTAL, done: true, summary };
  }

  return { ok: true, scored, question: questions[completed], total: TOTAL, done: false };
}
