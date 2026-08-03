/**
 * Resume builder — turns a Profile (+ optional venue analysis) into a ResumeDoc
 * via a single structured-extract call. Groq is preferred automatically by llm.ts.
 */

import { runStructuredExtract } from "@/src/lib/llm";
import type { AnalyzeResult, Profile, ResumeDoc } from "@/src/lib/agents/types";

const RESUME_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string", description: "One line under the name, e.g. 'Bartender — high-volume & craft cocktails'" },
    summary: { type: "string", description: "2-3 sentence professional summary" },
    experience: {
      type: "array",
      items: {
        type: "object",
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
    tailoredTo: { type: ["string", "null"] },
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
          bullets: strArr(e.bullets, 5),
        }))
        .slice(0, 6)
    : [];
  if (experience.length === 0) experience = experienceFromProfile(profile);

  return {
    headline: str(r.headline, profile.role || "Bartender"),
    summary: str(r.summary, profile.summary || ""),
    experience,
    skills: strArr(r.skills, 14).length ? strArr(r.skills, 14) : strArr(profile.skills, 14),
    certs: strArr(r.certs, 8).length ? strArr(r.certs, 8) : strArr(profile.certs, 8),
    extras: strArr(r.extras, 8),
    tailoredTo: tailored ? str(r.tailoredTo, venueName ?? "") || venueName : null,
  };
}

export async function buildResume(
  profile: Profile,
  analysis: AnalyzeResult | null,
): Promise<ResumeDoc> {
  const venueName = analysis?.venue?.name ?? analysis?.job.venueName ?? null;
  const tailored = !!analysis && !!venueName;

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
    "You write one-page NYC bartender resumes that get interviews. You are given the candidate's real profile as JSON",
    venueContext ? "plus research on the specific venue they are applying to." : "with no target venue.",
    "",
    "Hard rules:",
    "- NEVER invent employers, job titles, dates, certifications, or numbers. Every fact must come from the profile.",
    "- Rewrite the candidate's raw highlights into sharp, active-verb bullets (2-4 per job). Quantify ONLY with numbers the candidate actually provided; if none exist, use concrete non-numeric specifics (service style, volume descriptors the candidate used, systems named).",
    "- summary: 2-3 sentences, first person implied (no 'I'), confident, zero clichés ('team player', 'passionate' banned).",
    "- headline: one short line, role + strongest angle (e.g. 'Bartender — 8 yrs high-volume craft cocktails').",
    "- skills: ordered most-relevant-first. certs verbatim from profile. extras: signature drinks, languages, anything distinctive.",
    venueContext
      ? "- TAILOR: weave the venue's style (kind, spirits focus, service themes) into the summary, headline angle, and skills ordering — without inventing experience. Set tailoredTo to the venue name."
      : "- No venue given: keep it strong and general. Set tailoredTo to null.",
    "- Keep everything tight enough to fit one page.",
  ].join("\n");

  const userPrompt = JSON.stringify({ profile, venue: venueContext });

  const raw = await runStructuredExtract<Partial<ResumeDoc>>({
    systemPrompt,
    userPrompt,
    schema: RESUME_SCHEMA,
    maxTokens: 2048,
  });

  return normalizeResume(raw, profile, venueName, tailored);
}
