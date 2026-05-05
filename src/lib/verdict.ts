import type { JobAnalysis } from "./types";

/**
 * Roll the agent's outputs into a single, confident verdict the bartender
 * can read in 2 seconds. This is the *centerpiece* of an analysis result.
 */
export type Verdict = {
  label: "Strong fit" | "Solid match" | "Worth a look" | "Caution";
  tone: "strong" | "decent" | "caution";
  score: number;       // 0-100
  reason: string;      // short single-sentence summary
};

export function computeVerdict(job: JobAnalysis): Verdict {
  const greens = job.greenFlags?.length ?? 0;
  const reds   = job.redFlags?.length ?? 0;

  // Net signal: green flags minus red flags, normalized.
  const net = greens - reds;
  let score: number;
  let tone: Verdict["tone"];
  let label: Verdict["label"];

  if (net >= 3) {
    score = Math.min(95, 70 + net * 5);
    tone = "strong";
    label = "Strong fit";
  } else if (net >= 1) {
    score = 60 + net * 5;
    tone = "decent";
    label = "Solid match";
  } else if (net === 0) {
    score = 55;
    tone = "decent";
    label = "Worth a look";
  } else {
    score = Math.max(20, 50 + net * 8);
    tone = "caution";
    label = "Caution";
  }

  // Build a confident one-liner from the strongest signal.
  let reason = "";
  if (tone === "strong") {
    reason = job.greenFlags?.[0] || job.payVerdict || "Strong indicators across the board.";
  } else if (tone === "decent") {
    reason = job.payVerdict || job.greenFlags?.[0] || "Pay and conditions look reasonable.";
  } else {
    reason = job.redFlags?.[0] || "Multiple red flags worth weighing before applying.";
  }

  return { label, tone, score, reason: reason.replace(/^./, (c) => c.toUpperCase()) };
}
