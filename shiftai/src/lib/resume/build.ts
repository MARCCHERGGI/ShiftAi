/**
 * Resume builder — turns a Profile (+ optional venue analysis) into a ResumeDoc
 * via a single structured-extract call. Groq is preferred automatically by llm.ts.
 *
 * Venue-aware: detects the venue type from the analysis, pulls that type's
 * hiring playbook from `brain.ts` (real Manhattan listing intelligence), and
 * injects its vocabulary / bullet shapes / summary angle into the prompt.
 * Brain guidance shapes LANGUAGE only — facts come exclusively from the profile.
 */

import { runStructuredExtract } from "@/src/lib/llm";
import type { AnalyzeResult, Profile, ResumeDoc } from "@/src/lib/agents/types";
import {
  MANHATTAN_FACTS,
  RECRUITER_RULES,
  REJECTION_TRIGGERS,
  VENUE_TYPES,
  matchVenueType,
  type VenueType,
} from "@/src/lib/resume/brain";

// Schema kept provider-portable: additionalProperties:false + full required
// lists satisfy OpenAI strict mode; no union types so Gemini's OpenAPI-subset
// responseSchema accepts it too. tailoredTo is "" when untailored (normalized
// to null after parsing) because Gemini cannot express string|null.
const RESUME_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string", description: "One line under the name, e.g. 'Bartender — high-volume & craft cocktails'" },
    summary: { type: "string", description: "2-3 sentence professional summary" },
    experience: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          place: { type: "string" },
          role: { type: "string" },
          time: { type: "string" },
          bullets: { type: "array", items: { type: "string" } },
        },
        required: ["place", "role", "time", "bullets"],
      },
    },
    skills: { type: "array", items: { type: "string" } },
    certs: { type: "array", items: { type: "string" } },
    extras: { type: "array", items: { type: "string" } },
    tailoredTo: { type: "string", description: "The venue name when tailored; empty string when no target venue" },
  },
  required: ["headline", "summary", "experience", "skills", "certs", "extras", "tailoredTo"],
};

function strArr(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, max);
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/**
 * Classify the analysis into one of the brain's venue types by scanning every
 * descriptive string the crew produced (kind is the strongest signal; vibe,
 * price level, title, and listing text catch venues whose `kind` is vague).
 */
export function detectVenueType(analysis: AnalyzeResult | null): VenueType | null {
  if (!analysis) return null;
  const parts = [
    analysis.venue?.kind,
    analysis.venue?.vibe,
    analysis.venue?.summary,
    analysis.job.title,
    analysis.job.rawText?.slice(0, 1200),
  ].filter((s): s is string => typeof s === "string" && s.length > 0);
  // priceLevel disambiguates: $$$$ with no other signal reads fine-dining.
  const byText = matchVenueType(parts.join(" \n "));
  if (byText) return byText;
  if (analysis.venue?.priceLevel === "$$$$") return "fine-dining";
  return null;
}

/** Fallback experience straight from the profile when the model returns nothing usable. */
function experienceFromProfile(profile: Profile): ResumeDoc["experience"] {
  return (profile.workHistory ?? [])
    .filter((w) => w && (w.place || w.role))
    .map((w) => ({
      place: str(w.place, "—"),
      role: str(w.role, profile.role || "Bartender"),
      time: str(w.time),
      bullets: str(w.highlights)
        .split(/[\n;]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4),
    }));
}

/** Strip leftover template placeholders like "[N]" the model may copy from examples. */
function stripPlaceholders(s: string): string {
  return s
    .replace(/\[(?:N|POS|spirit|venue|X)\]%?/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

function normalizeResume(
  raw: Partial<ResumeDoc> | null | undefined,
  profile: Profile,
  venueName: string | null,
  tailored: boolean,
): ResumeDoc {
  const r = raw ?? {};
  let experience: ResumeDoc["experience"] = Array.isArray(r.experience)
    ? r.experience
        .filter((e) => e && typeof e === "object" && (str(e.place) || str(e.role)))
        .map((e) => ({
          place: str(e.place, "—"),
          role: str(e.role, profile.role || "Bartender"),
          time: str(e.time),
          bullets: strArr(e.bullets, 5).map(stripPlaceholders).filter(Boolean),
        }))
        .slice(0, 6)
    : [];
  if (experience.length === 0) experience = experienceFromProfile(profile);

  const skills = strArr(r.skills, 14).length ? strArr(r.skills, 14) : strArr(profile.skills, 14);
  return {
    headline: stripPlaceholders(str(r.headline, profile.role || "Bartender")),
    summary: stripPlaceholders(str(r.summary, profile.summary || "")),
    experience,
    skills: skills.map(stripPlaceholders).filter(Boolean),
    certs: strArr(r.certs, 8).length ? strArr(r.certs, 8) : strArr(profile.certs, 8),
    extras: strArr(r.extras, 8).map(stripPlaceholders).filter(Boolean),
    tailoredTo: tailored ? str(r.tailoredTo, venueName ?? "") || venueName : null,
  };
}

/* ── prompt assembly from the brain ──────────────── */

function venuePlaybook(type: VenueType): string {
  const b = VENUE_TYPES[type];
  return [
    `TARGET VENUE TYPE: ${b.label}`,
    "",
    `SUMMARY ANGLE (write the professional summary to this exact angle):`,
    b.summaryAngle,
    "",
    `VOCABULARY — mirror these exact words where the candidate's real experience supports them (Manhattan listings of this type use them verbatim):`,
    b.vocabulary.join(", "),
    "",
    `WHAT THESE EMPLOYERS SCREEN FOR (surface matching evidence from the profile in the top half of the resume):`,
    ...b.hiringSignals.map((s) => `- ${s}`),
    "",
    `STATED MINIMUMS AT THIS VENUE TYPE (if the profile meets one, say so plainly in the summary — e.g. years in format):`,
    ...b.mustHaves.map((s) => `- ${s}`),
    "",
    `BULLET SHAPES THAT WIN AT THIS VENUE TYPE — study the STRUCTURE (action verb + specific task + number + context). The [N] tokens are placeholders: NEVER output a bracket. Fill the shape ONLY with numbers and facts the candidate actually provided; if the profile has no number for a claim, write a concrete non-numeric specific instead:`,
    ...b.bulletPatterns.map((s) => `- ${s}`),
    "",
    `READS WRONG AT THIS VENUE TYPE (avoid):`,
    ...b.avoid.map((s) => `- ${s}`),
  ].join("\n");
}

function marketFacts(): string {
  return [
    "MANHATTAN MARKET FACTS (for wording only — never add a cert or system the profile lacks):",
    `- POS systems are matched on EXACT names: ${MANHATTAN_FACTS.pos.map((p) => p.name).join(", ")}. If the profile names one, keep the exact name; never substitute or add one.`,
    "- Cert naming for NYC: 'TIPS' may be written 'TIPS Certified (ATAP-approved)' — same credential. 'NYC Food Handler's Certificate' / 'NYC Food Protection Certificate' are the DOHMH names. Never rename a NYS-only cert as an NYC one, and never list a cert the profile does not have.",
    "- Quantification norms managers benchmark against (numbers must stay plausible for the room size claimed):",
    ...MANHATTAN_FACTS.quantificationNorms.slice(0, 5).map((s) => `  - ${s}`),
  ].join("\n");
}

function recruiterRulesBlock(): string {
  // The generation-relevant rules (delivery-logistics rules omitted).
  const rules = RECRUITER_RULES.filter((r) => !r.startsWith("In-person"));
  return ["RECRUITER RULES (a Manhattan bar manager scans for 6-8 seconds — these are the pass/fail criteria):", ...rules.map((r, i) => `${i + 1}. ${r}`)].join("\n");
}

function rejectionBlock(): string {
  return ["INSTANT-REJECTION TRIGGERS (any one of these kills the resume — produce none of them):", ...REJECTION_TRIGGERS.map((t) => `- ${t}`)].join("\n");
}

export async function buildResume(
  profile: Profile,
  analysis: AnalyzeResult | null,
): Promise<ResumeDoc> {
  const venueName = analysis?.venue?.name ?? analysis?.job.venueName ?? null;
  const tailored = !!analysis && !!venueName;
  const venueType = detectVenueType(analysis);

  const venueContext = analysis
    ? {
        venueName,
        kind: analysis.venue?.kind ?? null,
        vibe: analysis.venue?.vibe ?? null,
        neighborhood: analysis.venue?.neighborhood ?? analysis.job.neighborhood ?? null,
        priceLevel: analysis.venue?.priceLevel ?? null,
        spiritsFocus: analysis.menu?.spiritsFocus ?? null,
        signatureCocktails: analysis.menu?.cocktails?.slice(0, 5) ?? [],
        jobTitle: analysis.job.title,
        jobRequirements: analysis.job.requirements?.slice(0, 8) ?? [],
        serviceThemesFromReviews: analysis.reviews?.serviceNotes?.slice(0, 4) ?? [],
      }
    : null;

  const systemPrompt = [
    "You write one-page Manhattan bartender resumes that win the 6-8 second manager scan and get interviews. You are given the candidate's real profile as JSON" +
      (venueContext
        ? " plus research on the specific venue they are applying to."
        : " with no target venue."),
    "",
    "HONESTY — HARD RULES (violating any of these makes the resume worthless):",
    "- NEVER invent employers, job titles, dates, certifications, POS systems, or numbers. Every fact must come from the profile JSON.",
    "- The venue playbook below shapes LANGUAGE — word choice, ordering, emphasis, bullet structure — never facts. Do not create experience the candidate does not have.",
    "- Numbers: use every real number the candidate provided (covers, seats, sales, drinks/hour, taps, years, percentages) — restate them in bullet form. If a bullet has no real number available, anchor it with a concrete specific instead (system name, service style, program focus, shift type the candidate actually stated). Never estimate or round a number into existence.",
    "- Never output template placeholders: no brackets like [N], no 'X%'.",
    "",
    "QUANTIFY EVERY EXPERIENCE BULLET: each bullet = action verb + specific task + quantified metric (from the profile) + context. Mine the profile's highlights, summary, and yearsExperience for every number available and spread them across bullets. 'Served customers' is an instant fail; 'Served 180-220 covers per Friday/Saturday shift at a 90-seat cocktail bar' is the standard.",
    "",
    recruiterRulesBlock(),
    "",
    venueType ? venuePlaybook(venueType) : "",
    venueType ? "" : "No venue type detected: write a strong general Manhattan bartender resume — quantified bullets, exact POS/cert names from the profile, working-bartender tone.",
    "",
    marketFacts(),
    "",
    rejectionBlock(),
    "",
    "OUTPUT FIELDS:",
    "- headline: one short line, role + strongest true angle" + (venueType ? ` matched to the venue type (e.g. 'Bartender — ${VENUE_TYPES[venueType].label}, N yrs' with the real years)` : "") + ".",
    "- summary: 2-3 sentences to the summary angle above. First person implied (no 'I'). Lead with years-in-format and the strongest venue-relevant evidence. Banned words: 'team player', 'passionate', 'hardworking', 'dynamic', 'results-driven'.",
    "- experience: newest first, 2-4 bullets per job, every bullet quantified per the rules above.",
    "- skills: ordered most-relevant-first FOR THIS VENUE TYPE; exact POS and cert names from the profile.",
    "- certs: verbatim from the profile (NYC naming polish allowed, no additions).",
    "- extras: signature drinks, languages, anything venue-relevant from the profile.",
    venueContext
      ? "- tailoredTo: the venue name."
      : "- tailoredTo: empty string.",
    "- Keep everything tight enough to fit one page.",
  ]
    .filter((s) => s !== "")
    .join("\n");

  const userPrompt = JSON.stringify({ profile, venue: venueContext });

  const raw = await runStructuredExtract<Partial<ResumeDoc>>({
    systemPrompt,
    userPrompt,
    schema: RESUME_SCHEMA,
    maxTokens: 1600,
  });

  return normalizeResume(raw, profile, venueName, tailored);
}
