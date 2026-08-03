/**
 * Resume judge — scores a ResumeDoc against the Manhattan hiring intelligence
 * in `brain.ts` the way a bar manager would: 6-8 second scan, venue-type fit,
 * quantification, ATS safety, and honesty against the source profile.
 *
 * The LLM grades the five dimensions; deterministic checks then enforce the
 * hard failures a model might excuse (fabricated employers/certs, template
 * placeholders, a numbers-free resume). Overall score is computed here, not
 * taken from the model, so the rubric cannot be flattered away.
 */

import { runStructuredExtract } from "@/src/lib/llm";
import type { AnalyzeResult, Profile, ResumeDoc } from "@/src/lib/agents/types";
import {
  MANHATTAN_FACTS,
  RECRUITER_RULES,
  REJECTION_TRIGGERS,
  VENUE_TYPES,
} from "@/src/lib/resume/brain";
import { detectVenueType } from "@/src/lib/resume/build";

export interface JudgeBreakdown {
  /** Does the resume match this job/venue — right experience surfaced, minimums addressed? */
  relevance: number;
  /** Are experience bullets quantified with plausible, profile-sourced metrics? */
  quantification: number;
  /** Tone + vocabulary fit for the detected venue type (working bartender, not tourist)? */
  venueFit: number;
  /** One-page discipline, exact POS/cert names, clean text, no placeholders/clichés? */
  atsSafety: number;
  /** Every employer, cert, date, and number traceable to the profile? */
  honesty: number;
}

export interface JudgeResult {
  /** 0-10 overall. 8+ = would get an interview at this venue type. */
  score: number;
  breakdown: JudgeBreakdown;
  fixes: string[];
}

const JUDGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    relevance: { type: "number", description: "0-10 per rubric" },
    quantification: { type: "number", description: "0-10 per rubric" },
    venueFit: { type: "number", description: "0-10 per rubric" },
    atsSafety: { type: "number", description: "0-10 per rubric" },
    honesty: { type: "number", description: "0-10 per rubric" },
    fixes: {
      type: "array",
      items: { type: "string" },
      description: "Specific, actionable fixes ordered by impact; empty only if genuinely nothing to improve",
    },
  },
  required: ["relevance", "quantification", "venueFit", "atsSafety", "honesty", "fixes"],
};

function clamp10(n: unknown): number {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  return Math.max(0, Math.min(10, v));
}

/* ── deterministic hard checks ───────────────────── */

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Token-overlap match: does `candidate` plausibly refer to one of `sources`? */
function traceable(candidate: string, sources: string[]): boolean {
  const cand = norm(candidate);
  if (!cand) return true;
  const candTokens = cand.split(" ").filter((t) => t.length > 2);
  for (const src of sources) {
    const s = norm(src);
    if (!s) continue;
    if (s.includes(cand) || cand.includes(s)) return true;
    const srcTokens = new Set(s.split(" "));
    if (candTokens.some((t) => srcTokens.has(t))) return true;
  }
  return false;
}

interface HardCheck {
  fixes: string[];
  honestyCap: number | null;
  quantCap: number | null;
  atsCap: number | null;
}

function hardChecks(resume: ResumeDoc, profile: Profile): HardCheck {
  const out: HardCheck = { fixes: [], honestyCap: null, quantCap: null, atsCap: null };

  // 1. Fabricated employers: every experience place must trace to the profile.
  const knownPlaces = (profile.workHistory ?? []).map((w) => w.place).filter(Boolean);
  for (const exp of resume.experience) {
    if (exp.place && exp.place !== "—" && !traceable(exp.place, knownPlaces)) {
      out.fixes.push(`Fabricated employer: "${exp.place}" is not in the candidate's work history — remove it.`);
      out.honestyCap = Math.min(out.honestyCap ?? 2, 2);
    }
  }

  // 2. Fabricated certs: every cert must trace to the profile's cert list.
  const knownCerts = (profile.certs ?? []).filter(Boolean);
  for (const cert of resume.certs) {
    if (!traceable(cert, knownCerts)) {
      out.fixes.push(`Fabricated certification: "${cert}" is not in the candidate's profile — remove it.`);
      out.honestyCap = Math.min(out.honestyCap ?? 2, 2);
    }
  }

  // 3. Template placeholders anywhere = instant ATS/quantification failure.
  const allText = [
    resume.headline,
    resume.summary,
    ...resume.experience.flatMap((e) => [e.place, e.role, e.time, ...e.bullets]),
    ...resume.skills,
    ...resume.certs,
    ...resume.extras,
  ].join(" \n ");
  if (/\[[^\]]{1,20}\]/.test(allText)) {
    out.fixes.push("Template placeholders (bracketed tokens) survived into the resume — replace with real values.");
    out.atsCap = Math.min(out.atsCap ?? 4, 4);
    out.quantCap = Math.min(out.quantCap ?? 4, 4);
  }

  // 4. Zero numbers anywhere in experience = fails the volume check outright.
  const expText = resume.experience.flatMap((e) => e.bullets).join(" ");
  if (resume.experience.length > 0 && !/\d/.test(expText + resume.summary)) {
    out.fixes.push("No numbers anywhere — add covers/sales/seats/years from the profile; a numbers-free resume fails the 6-second volume scan.");
    out.quantCap = Math.min(out.quantCap ?? 3, 3);
  }

  return out;
}

/* ── LLM rubric ──────────────────────────────────── */

function rubric(venueLabel: string | null, venuePlaybook: string): string {
  return [
    "You are a harsh Manhattan bar manager and hospitality recruiter reviewing a bartender resume. You give a resume 6-8 seconds; the interview pile is small. Grade EXACTLY per this rubric — most resumes you see score 5-7; 8+ means you would actually call this person in for an interview" +
      (venueLabel ? ` at a ${venueLabel} venue.` : "."),
    "",
    "You are given: the resume (as structured JSON), the candidate's raw profile (ground truth for every fact), and the target venue context (may be null).",
    "",
    "GRADE FIVE DIMENSIONS, each 0-10:",
    "",
    "1. relevance — Does the top third of the resume surface what THIS venue screens for? Years-in-format stated in the summary? Strongest venue-relevant experience first? Generic resume that could go to any bar = max 6.",
    "",
    "2. quantification — Is every experience bullet action verb + specific task + metric + context? Metrics plausible for the room size claimed (a manager sanity-checks 1,000 covers solo at a 40-seat bar as a lie)? Bullets that are duties-prose ('responsible for serving customers') = max 4. Numbers only in one bullet while others are vague = max 6. NOTE: only penalize missing numbers where the profile actually contained numbers to use; a bullet anchored by a concrete specific (named POS, program style) when no number existed is acceptable.",
    "",
    "3. venueFit — Tone and vocabulary for the venue type. " + (venuePlaybook ? "Use the playbook below: does the resume mirror this venue type's vocabulary where the experience supports it, follow the summary angle, and avoid what reads wrong here? Tone mismatch (nightlife bravado to a fine-dining room, formal fluff to a pub) = max 4." : "No venue given: grade general working-bartender tone — does this read like a working bartender or a tourist?"),
    "",
    "4. atsSafety — One-page discipline (tight bullet counts, no bloat), EXACT POS system names, correct NYC cert names (TIPS/ATAP, NYC Food Handler's/Food Protection — a NYS-only cert named as valid in NYC is an error), professional contact, zero typos, zero template placeholders, zero banned clichés ('team player', 'passionate', 'hardworking').",
    "",
    "5. honesty — Cross-check EVERY employer, title, date, cert, and number in the resume against the profile JSON. Anything not traceable to the profile = fabrication: cap honesty at 2 and name the fabrication in fixes. Rounded/restated versions of profile facts are fine; invented ones are not.",
    "",
    venuePlaybook,
    "",
    "RECRUITER RULES (the standard you grade against):",
    ...RECRUITER_RULES.slice(0, 10).map((r, i) => `${i + 1}. ${r}`),
    "",
    "INSTANT-REJECTION TRIGGERS (any one present = the affected dimension scores 0-3 and the overall verdict is 'would not interview'):",
    ...REJECTION_TRIGGERS.map((t) => `- ${t}`),
    "",
    "QUANTIFICATION NORMS you benchmark numbers against:",
    ...MANHATTAN_FACTS.quantificationNorms.map((s) => `- ${s}`),
    "",
    "fixes: the specific, ordered changes that would most raise the score. Name the exact bullet/section each fix targets. Be blunt.",
  ].join("\n");
}

export async function judgeResume(
  resume: ResumeDoc,
  profile: Profile,
  analysis: AnalyzeResult | null,
): Promise<JudgeResult> {
  const venueType = detectVenueType(analysis);
  const brief = venueType ? VENUE_TYPES[venueType] : null;
  const playbook = brief
    ? [
        `TARGET VENUE TYPE: ${brief.label}`,
        `Summary angle expected: ${brief.summaryAngle}`,
        `Vocabulary this venue type uses: ${brief.vocabulary.join(", ")}`,
        `What they screen for: ${brief.hiringSignals.join(" | ")}`,
        `Stated minimums: ${brief.mustHaves.join(" | ")}`,
        `Reads wrong here: ${brief.avoid.join(" | ")}`,
      ].join("\n")
    : "";

  const raw = await runStructuredExtract<Partial<JudgeBreakdown> & { fixes?: unknown }>({
    systemPrompt: rubric(brief?.label ?? null, playbook),
    userPrompt: JSON.stringify({
      resume,
      profile,
      venue: analysis
        ? {
            name: analysis.venue?.name ?? analysis.job.venueName ?? null,
            kind: analysis.venue?.kind ?? null,
            vibe: analysis.venue?.vibe ?? null,
            priceLevel: analysis.venue?.priceLevel ?? null,
            jobTitle: analysis.job.title,
            jobRequirements: analysis.job.requirements?.slice(0, 8) ?? [],
          }
        : null,
    }),
    schema: JUDGE_SCHEMA,
    maxTokens: 1100,
  });

  const breakdown: JudgeBreakdown = {
    relevance: clamp10(raw?.relevance),
    quantification: clamp10(raw?.quantification),
    venueFit: clamp10(raw?.venueFit),
    atsSafety: clamp10(raw?.atsSafety),
    honesty: clamp10(raw?.honesty),
  };
  const fixes = Array.isArray(raw?.fixes)
    ? raw.fixes.filter((f): f is string => typeof f === "string" && f.trim().length > 0).slice(0, 10)
    : [];

  // Deterministic hard checks override model generosity.
  const hard = hardChecks(resume, profile);
  if (hard.honestyCap !== null) breakdown.honesty = Math.min(breakdown.honesty, hard.honestyCap);
  if (hard.quantCap !== null) breakdown.quantification = Math.min(breakdown.quantification, hard.quantCap);
  if (hard.atsCap !== null) breakdown.atsSafety = Math.min(breakdown.atsSafety, hard.atsCap);
  fixes.push(...hard.fixes);

  // Overall: mean of the five, hard-capped by honesty — a dishonest resume
  // cannot score well no matter how polished.
  const mean =
    (breakdown.relevance +
      breakdown.quantification +
      breakdown.venueFit +
      breakdown.atsSafety +
      breakdown.honesty) /
    5;
  const score = Math.round(Math.min(mean, breakdown.honesty < 5 ? breakdown.honesty : 10) * 10) / 10;

  return { score, breakdown, fixes };
}
