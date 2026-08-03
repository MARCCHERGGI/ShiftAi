/**
 * The Shift AI agent crew — six agents that turn one job link into a
 * venue-researched walk-in plan for a bartender.
 *
 *   scout     → parse the listing into JobExtract        (structured extract)
 *   venue     → identify the actual bar/restaurant        (web search + extract)
 *   menu      → menu + cocktail program                   (web search + extract)  ┐
 *   people    → owners / management / history             (web search + extract)  ├ parallel
 *   reviews   → customer review signal                    (web search + extract)  ┘
 *   synthesis → the walk-in plan                          (chat over all JSON)
 *
 * All LLM access goes through src/lib/llm.ts. Every prompt speaks to the
 * same person: a bartender in NYC about to walk into this venue.
 */

import type {
  AnalyzeResult,
  CrewEvent,
  JobExtract,
  MenuIntel,
  PeopleIntel,
  ReviewIntel,
  Synthesis,
  VenueIntel,
} from "@/src/lib/agents/types";
import { runChat, runStructuredExtract, runWebSearch } from "@/src/lib/llm";
import { fetchJobText, JobFetchError } from "@/src/lib/agents/fetchJob";

export interface CrewInput {
  url?: string;
  text?: string;
}

/** Thrown when the scout stage fails — the whole run dies with it. */
export class CrewError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrewError";
  }
}

const RAW_TEXT_CAP = 6_000;
const SEARCH_TEXT_CAP = 5_000;

/* ────────────────────────────  JSON SCHEMA HELPERS  ────────────────────────────
   Built to satisfy every provider llm.ts can route to: additionalProperties:false
   and required = all keys (OpenAI strict), plain draft JSON Schema (Groq embeds
   it textually in the prompt). */

const STR = { type: "string" } as const;
const STR_OR_NULL = { type: ["string", "null"] } as const;
const STR_ARR = { type: "array", items: { type: "string" } } as const;

function obj(props: Record<string, unknown>): object {
  return {
    type: "object",
    properties: props,
    required: Object.keys(props),
    additionalProperties: false,
  };
}

/* ────────────────────────────  NORMALIZERS  ────────────────────────────
   Model JSON is never fully trusted — coerce every field to its contract
   shape so downstream pages never see undefined where a type promises a
   string or an array. */

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asStrOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t || /^(null|none|unknown|n\/a)$/i.test(t)) return null;
  return t;
}

function asStrArr(v: unknown, max = 12): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, max);
}

function clampScore(v: unknown, fallback = 50): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/* ────────────────────────────  1 · SCOUT  ──────────────────────────── */

interface ScoutModelOut {
  title: string;
  role: string;
  venueName: string | null;
  venueAddress: string | null;
  neighborhood: string | null;
  pay: string | null;
  schedule: string | null;
  requirements: string[];
  perks: string[];
  redFlags: string[];
}

const SCOUT_SCHEMA = obj({
  title: STR,
  role: STR,
  venueName: STR_OR_NULL,
  venueAddress: STR_OR_NULL,
  neighborhood: STR_OR_NULL,
  pay: STR_OR_NULL,
  schedule: STR_OR_NULL,
  requirements: STR_ARR,
  perks: STR_ARR,
  redFlags: STR_ARR,
});

export async function runScout(input: CrewInput): Promise<JobExtract> {
  let url: string | null = null;
  let source: string;
  let text: string;

  if (input.url && input.url.trim()) {
    let fetched;
    try {
      fetched = await fetchJobText(input.url);
    } catch (err) {
      const msg =
        err instanceof JobFetchError
          ? err.message
          : "Couldn't fetch that listing. Paste the listing text instead.";
      throw new CrewError(msg);
    }
    url = fetched.url;
    source = fetched.source;
    text = fetched.text;
  } else if (input.text && input.text.trim().length >= 40) {
    source = "pasted text";
    text = input.text.trim().slice(0, 9_000);
  } else {
    throw new CrewError("Paste a job link or the listing text (at least a few sentences).");
  }

  let out: ScoutModelOut;
  try {
    out = await runStructuredExtract<ScoutModelOut>({
      systemPrompt: [
        "You are the SCOUT on an agent crew helping a bartender in NYC size up a job listing before they walk in.",
        "Parse the listing text into clean structured fields. Be literal — only what the listing actually says.",
        "venueName: the bar/restaurant's actual name. Many listings hide it ('busy downtown cocktail bar') — return null then, do NOT invent one.",
        "role: the position being hired for, lowercase ('bartender', 'barback', 'server', ...).",
        "neighborhood: the NYC neighborhood if stated or clearly implied by an address.",
        "pay/schedule: exactly as stated, null when absent.",
        "requirements/perks: short phrases, as listed.",
        "redFlags: scam or bad-workplace signals IN THE LISTING ITSELF — upfront fees, asks for SSN/bank info before hiring, pay wildly above market ($45+/hr for a starter role), vague 'hospitality opportunity' with no concrete role, off-platform application gates, 'text this number to apply' with no venue identity. Empty array when clean.",
      ].join("\n"),
      userPrompt: `LISTING (source: ${source}):\n\n${text}`,
      schema: SCOUT_SCHEMA,
      maxTokens: 1500,
    });
  } catch (err) {
    throw new CrewError(
      `Couldn't parse the listing: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const title = asStr(out.title) || "Job listing";
  return {
    url,
    source,
    title,
    role: asStr(out.role, "bartender").toLowerCase(),
    venueName: asStrOrNull(out.venueName),
    venueAddress: asStrOrNull(out.venueAddress),
    neighborhood: asStrOrNull(out.neighborhood),
    pay: asStrOrNull(out.pay),
    schedule: asStrOrNull(out.schedule),
    requirements: asStrArr(out.requirements),
    perks: asStrArr(out.perks),
    redFlags: asStrArr(out.redFlags),
    rawText: text.slice(0, RAW_TEXT_CAP),
  };
}

/* ────────────────────────────  2 · VENUE  ──────────────────────────── */

interface VenueModelOut {
  identified: boolean;
  name: string;
  confidence: "high" | "medium" | "low";
  kind: string;
  vibe: string;
  address: string | null;
  neighborhood: string | null;
  hospitalityGroup: string | null;
  priceLevel: string | null;
  links: { label: string; url: string }[];
  summary: string;
}

const VENUE_SCHEMA = obj({
  identified: { type: "boolean" },
  name: STR,
  confidence: { type: "string", enum: ["high", "medium", "low"] },
  kind: STR,
  vibe: STR,
  address: STR_OR_NULL,
  neighborhood: STR_OR_NULL,
  hospitalityGroup: STR_OR_NULL,
  priceLevel: STR_OR_NULL,
  links: { type: "array", items: obj({ label: STR, url: STR }) },
  summary: STR,
});

export async function runVenue(job: JobExtract): Promise<VenueIntel | null> {
  const named = !!job.venueName;
  const locality = job.neighborhood ?? job.venueAddress ?? "NYC";

  const searchPrompt = named
    ? `${job.venueName} ${locality} NYC bar restaurant — what is this place? Concept, vibe, address, neighborhood, hospitality/restaurant group, price level, official site or notable links.`
    : [
        "A NYC job listing hides the venue's name. Try to figure out which bar/restaurant it is from these clues, searching if useful:",
        job.venueAddress ? `Address clue: ${job.venueAddress}` : null,
        job.neighborhood ? `Neighborhood: ${job.neighborhood}` : null,
        `Listing title: ${job.title}`,
        `Listing excerpt: ${job.rawText.slice(0, 1_800)}`,
        "If you find a strong candidate, describe it (concept, vibe, address, group, price level). If it genuinely can't be identified, say so plainly.",
      ]
        .filter(Boolean)
        .join("\n");

  const search = await runWebSearch({
    systemPrompt:
      "You research NYC bars and restaurants for a bartender preparing to apply there. Be concrete and factual; say clearly when something can't be verified.",
    userPrompt: searchPrompt,
    maxOutputTokens: 1_200,
  });

  if (!search.text.trim()) return null;

  const out = await runStructuredExtract<VenueModelOut>({
    systemPrompt: [
      "You are the VENUE agent on a crew prepping a bartender for a job application.",
      "From the research notes, produce a structured venue profile.",
      "identified: true only when the notes point to one specific real venue. If the notes say it can't be identified, or only describe a generic guess, set identified false.",
      "confidence: 'high' when the listing named the venue and research confirms it; 'medium' when research strongly implies it; 'low' when it's an inference from clues.",
      "kind: short label like 'cocktail bar', 'rooftop', 'neighborhood dive', 'hotel bar', 'natural wine bar'.",
      "vibe: ONE sentence reading the room — what it feels like to work or drink there.",
      "links: up to 4 useful links from the notes (official site, menu, press). Empty array if none.",
      "summary: 2-3 sentences a bartender would want before walking in.",
    ].join("\n"),
    userPrompt: [
      `LISTING FACTS: venueName=${job.venueName ?? "null"}, address=${job.venueAddress ?? "null"}, neighborhood=${job.neighborhood ?? "null"}, role=${job.role}`,
      "",
      `RESEARCH NOTES:\n${search.text.slice(0, SEARCH_TEXT_CAP)}`,
      search.groundingUrls.length ? `\nSOURCE URLS:\n${search.groundingUrls.slice(0, 6).join("\n")}` : "",
    ].join("\n"),
    schema: VENUE_SCHEMA,
    maxTokens: 1500,
  });

  const name = asStr(out.name) || asStr(job.venueName ?? "");
  if (!out.identified || !name) return null;

  const allowed = new Set(["high", "medium", "low"]);
  let confidence: VenueIntel["confidence"] = allowed.has(out.confidence) ? out.confidence : "low";
  if (!named) confidence = "low"; // inferred venue is never better than low

  const links = Array.isArray(out.links)
    ? out.links
        .filter(
          (l): l is { label: string; url: string } =>
            !!l && typeof l.label === "string" && typeof l.url === "string" && /^https?:\/\//.test(l.url),
        )
        .map((l) => ({ label: l.label.trim().slice(0, 80), url: l.url.trim() }))
        .slice(0, 4)
    : [];

  return {
    name,
    confidence,
    kind: asStr(out.kind, "bar"),
    vibe: asStr(out.vibe),
    address: asStrOrNull(out.address) ?? job.venueAddress,
    neighborhood: asStrOrNull(out.neighborhood) ?? job.neighborhood,
    hospitalityGroup: asStrOrNull(out.hospitalityGroup),
    priceLevel: asStrOrNull(out.priceLevel),
    links,
    summary: asStr(out.summary),
  };
}

/* ────────────────────────────  3 · MENU  ──────────────────────────── */

const MENU_SCHEMA = obj({
  summary: STR,
  signatureItems: STR_ARR,
  cocktails: STR_ARR,
  spiritsFocus: STR_OR_NULL,
  beerWine: STR_OR_NULL,
  talkingPoints: STR_ARR,
});

export async function runMenu(job: JobExtract, venue: VenueIntel | null): Promise<MenuIntel | null> {
  const name = venue?.name ?? job.venueName;
  if (!name) return null;
  const locality = venue?.neighborhood ?? job.neighborhood ?? "NYC";

  const search = await runWebSearch({
    systemPrompt:
      "You research a specific NYC venue's food and drink program for a bartender interviewing there. Name actual dishes, cocktails, and spirits when findable.",
    userPrompt: `"${name}" ${locality} NYC menu, signature cocktails, house drinks, spirits focus, beer and wine program. What should a bartender know by name before an interview there?`,
    maxOutputTokens: 1_200,
  });
  if (!search.text.trim()) return null;

  const out = await runStructuredExtract<MenuIntel>({
    systemPrompt: [
      "You are the MENU agent on a crew prepping a bartender for an interview at this venue.",
      "From the research notes, extract the drink-and-food intel that matters behind the bar.",
      "signatureItems: dishes worth knowing by name. cocktails: signature/house cocktails by name.",
      "spiritsFocus: e.g. 'agave-forward', 'whiskey bar', null when unclear. beerWine: one-line read, null when unclear.",
      "talkingPoints: 3-5 menu-specific things the bartender can SAY in the interview ('I saw your mezcal list runs deep — do you build the negroni variations tableside?'). Only include things grounded in the notes.",
      "summary: 2-3 sentences on the overall program. If the notes contain nothing real about this venue's menu, keep arrays empty and say so in the summary.",
    ].join("\n"),
    userPrompt: `VENUE: ${name} (${locality})\n\nRESEARCH NOTES:\n${search.text.slice(0, SEARCH_TEXT_CAP)}`,
    schema: MENU_SCHEMA,
    maxTokens: 1200,
  });

  return {
    summary: asStr(out.summary),
    signatureItems: asStrArr(out.signatureItems),
    cocktails: asStrArr(out.cocktails),
    spiritsFocus: asStrOrNull(out.spiritsFocus),
    beerWine: asStrOrNull(out.beerWine),
    talkingPoints: asStrArr(out.talkingPoints, 6),
  };
}

/* ────────────────────────────  4 · PEOPLE  ──────────────────────────── */

const PEOPLE_SCHEMA = obj({
  summary: STR,
  owners: STR_ARR,
  management: STR_ARR,
  history: STR,
  turnoverSignals: STR_ARR,
  talkingPoints: STR_ARR,
});

export async function runPeople(
  job: JobExtract,
  venue: VenueIntel | null,
): Promise<PeopleIntel | null> {
  const name = venue?.name ?? job.venueName;
  if (!name) return null;
  const locality = venue?.neighborhood ?? job.neighborhood ?? "NYC";
  const group = venue?.hospitalityGroup ? ` (part of ${venue.hospitalityGroup})` : "";

  const search = await runWebSearch({
    systemPrompt:
      "You research the people behind a specific NYC venue for a bartender applying there: owners, GM, bar director, chef, opening story, press about workplace culture. Facts with names; note when nothing is findable.",
    userPrompt: `"${name}" ${locality} NYC${group} — who owns it, who runs it (GM, bar director, head chef), when did it open, previous concepts at the space, expansions, and any press about staff turnover, lawsuits, or workplace culture.`,
    maxOutputTokens: 1_200,
  });
  if (!search.text.trim()) return null;

  const out = await runStructuredExtract<PeopleIntel>({
    systemPrompt: [
      "You are the PEOPLE agent on a crew prepping a bartender for an interview at this venue.",
      "From the research notes, extract who the bartender will actually be dealing with.",
      "owners: names of owners/partners. management: 'Role — Name' entries for GM, bar director, head chef when findable.",
      "history: one short paragraph — opened when, previous concepts, expansions.",
      "turnoverSignals: churn, lawsuits, culture press — ONLY when the notes actually report it. Empty array = none found.",
      "talkingPoints: 3-5 people-aware lines the bartender can use ('I read the bar director came over from Attaboy — the stirred program shows it').",
      "summary: 2-3 sentences. If the notes found nothing real, keep arrays empty and say so.",
    ].join("\n"),
    userPrompt: `VENUE: ${name} (${locality})${group}\n\nRESEARCH NOTES:\n${search.text.slice(0, SEARCH_TEXT_CAP)}`,
    schema: PEOPLE_SCHEMA,
    maxTokens: 1200,
  });

  return {
    summary: asStr(out.summary),
    owners: asStrArr(out.owners, 8),
    management: asStrArr(out.management, 8),
    history: asStr(out.history),
    turnoverSignals: asStrArr(out.turnoverSignals, 6),
    talkingPoints: asStrArr(out.talkingPoints, 6),
  };
}

/* ────────────────────────────  5 · REVIEWS  ──────────────────────────── */

const REVIEWS_SCHEMA = obj({
  summary: STR,
  rating: STR_OR_NULL,
  praise: STR_ARR,
  complaints: STR_ARR,
  serviceNotes: STR_ARR,
  talkingPoints: STR_ARR,
});

export async function runReviews(
  job: JobExtract,
  venue: VenueIntel | null,
): Promise<ReviewIntel | null> {
  const name = venue?.name ?? job.venueName;
  if (!name) return null;
  const locality = venue?.neighborhood ?? job.neighborhood ?? "NYC";

  const search = await runWebSearch({
    systemPrompt:
      "You read customer reviews of a specific NYC venue for a bartender applying to work there. Care most about what reviewers say about the STAFF and service, plus recurring praise and complaints. Include ratings with their platform when findable.",
    userPrompt: `"${name}" ${locality} NYC reviews — Google, Yelp, recent press. What do customers praise, what do they complain about, and what do they say about the bartenders and service specifically? Include the rating (e.g. "4.4 on Google") if findable.`,
    maxOutputTokens: 1_200,
  });
  if (!search.text.trim()) return null;

  const out = await runStructuredExtract<ReviewIntel>({
    systemPrompt: [
      "You are the REVIEWS agent on a crew prepping a bartender for an interview at this venue.",
      "From the research notes, extract the customer signal.",
      "rating: '4.4 on Google' style, null when not in the notes — never invent a number.",
      "praise/complaints: recurring THEMES as short phrases, not individual quotes.",
      "serviceNotes: what reviewers say about the STAFF specifically — speed, warmth, cocktail knowledge, attitude.",
      "talkingPoints: 3-5 review-aware lines the bartender can use ('Reviews rave about the bar team's pacing on rush nights — how do you staff the Friday push?').",
      "summary: 2-3 sentences. If the notes found nothing real, keep arrays empty and say so.",
    ].join("\n"),
    userPrompt: `VENUE: ${name} (${locality})\n\nRESEARCH NOTES:\n${search.text.slice(0, SEARCH_TEXT_CAP)}`,
    schema: REVIEWS_SCHEMA,
    maxTokens: 1200,
  });

  return {
    summary: asStr(out.summary),
    rating: asStrOrNull(out.rating),
    praise: asStrArr(out.praise, 6),
    complaints: asStrArr(out.complaints, 6),
    serviceNotes: asStrArr(out.serviceNotes, 6),
    talkingPoints: asStrArr(out.talkingPoints, 6),
  };
}

/* ────────────────────────────  6 · SYNTHESIS  ──────────────────────────── */

const SYNTHESIS_SCHEMA = obj({
  brief: STR,
  fitScore: { type: "number" },
  walkInPlan: STR_ARR,
  talkingPoints: STR_ARR,
  questionsToAsk: STR_ARR,
  redFlags: STR_ARR,
});

const SYNTHESIS_SYSTEM = [
  "You are the SYNTHESIS agent — the crew chief. A bartender in NYC is about to walk into this venue to apply. Merge everything the crew found into one sharp, practical game plan.",
  "Speak directly to the bartender. Concrete over generic — name the cocktails, the people, the review themes when the crew found them.",
  "brief: 2-3 sentences — here's the play.",
  "fitScore: 0-100 — how strong this venue/listing looks for a working bartender. Weigh: real identified venue, plausible pay, program quality, review sentiment about staff, red flags. A hidden venue with scam signals scores low; a named, well-reviewed cocktail bar with clear pay scores high.",
  "walkInPlan: 4-6 ordered, concrete prep steps (what to read, what to wear, when to walk in, what to bring, what to taste beforehand if possible).",
  "talkingPoints: the 4-6 BEST talking points across all agents, deduped and rewritten in the bartender's voice.",
  "questionsToAsk: 3-5 smart questions for the interviewer that show the research without showing off.",
  "redFlags: listing red flags + venue red flags (turnover signals, complaint themes that affect staff) merged. Empty array when clean.",
  "Return ONLY a JSON object with exactly these keys: brief (string), fitScore (number), walkInPlan (string[]), talkingPoints (string[]), questionsToAsk (string[]), redFlags (string[]). No markdown, no fences, no commentary.",
].join("\n");

function synthesisUserPrompt(
  job: JobExtract,
  venue: VenueIntel | null,
  menu: MenuIntel | null,
  people: PeopleIntel | null,
  reviews: ReviewIntel | null,
): string {
  const { rawText, ...jobNoRaw } = job;
  return [
    "CREW FINDINGS (null = that agent found nothing):",
    `JOB: ${JSON.stringify(jobNoRaw)}`,
    `VENUE: ${JSON.stringify(venue)}`,
    `MENU: ${JSON.stringify(menu)}`,
    `PEOPLE: ${JSON.stringify(people)}`,
    `REVIEWS: ${JSON.stringify(reviews)}`,
    "",
    `LISTING EXCERPT: ${rawText.slice(0, 1_500)}`,
  ].join("\n");
}

function parseJsonLoose(text: string): unknown {
  const stripped = text.replace(/```(?:json)?/gi, "").trim();
  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no JSON object in output");
  return JSON.parse(stripped.slice(start, end + 1));
}

function normalizeSynthesis(raw: unknown, job: JobExtract): Synthesis {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    brief: asStr(o.brief, "Crew research complete — see the intel cards below."),
    fitScore: clampScore(o.fitScore),
    walkInPlan: asStrArr(o.walkInPlan, 8),
    talkingPoints: asStrArr(o.talkingPoints, 8),
    questionsToAsk: asStrArr(o.questionsToAsk, 6),
    redFlags: asStrArr(o.redFlags, 8).length ? asStrArr(o.redFlags, 8) : [...job.redFlags],
  };
}

export async function runSynthesis(
  job: JobExtract,
  venue: VenueIntel | null,
  menu: MenuIntel | null,
  people: PeopleIntel | null,
  reviews: ReviewIntel | null,
): Promise<Synthesis> {
  const userPrompt = synthesisUserPrompt(job, venue, menu, people, reviews);

  try {
    const text = await runChat({
      system: SYNTHESIS_SYSTEM,
      messages: [{ role: "user", content: userPrompt }],
      maxTokens: 1600,
    });
    return normalizeSynthesis(parseJsonLoose(text), job);
  } catch (err) {
    console.warn("[crew] synthesis chat failed, retrying via structured extract:", err);
  }

  try {
    const out = await runStructuredExtract<Synthesis>({
      systemPrompt: SYNTHESIS_SYSTEM,
      userPrompt,
      schema: SYNTHESIS_SCHEMA,
      maxTokens: 1600,
    });
    return normalizeSynthesis(out, job);
  } catch (err) {
    console.warn("[crew] synthesis extract failed, building fallback plan:", err);
  }

  // Deterministic last resort — the run still completes with an honest plan.
  const venueName = venue?.name ?? job.venueName;
  return {
    brief: venueName
      ? `The crew pulled what it could on ${venueName}. Review the intel cards, then walk in during off-peak hours with a printed resume.`
      : "The listing hides the venue, so prep on fundamentals: sharp resume, classic specs cold, and vet the place in person before sharing any personal info.",
    fitScore: job.redFlags.length ? 35 : venueName ? 60 : 45,
    walkInPlan: [
      venueName ? `Look up ${venueName}'s menu online and learn 2-3 signature items by name.` : "Reply to the listing and ask for the venue name before investing more time.",
      "Print two copies of your resume; dress one notch above the venue's floor staff.",
      "Walk in between 2-4pm on a weekday — after lunch service, before dinner setup.",
      "Ask for the GM or bar manager by title; keep the intro under 30 seconds.",
    ],
    talkingPoints: [
      ...(menu?.talkingPoints ?? []),
      ...(people?.talkingPoints ?? []),
      ...(reviews?.talkingPoints ?? []),
    ].slice(0, 5),
    questionsToAsk: [
      "How is the bar team structured on a Friday night — how many behind the stick?",
      "What does the training period look like before someone runs their own well?",
      "How do you split tips between bar and floor?",
    ],
    redFlags: [...job.redFlags],
  };
}

/* ────────────────────────────  PIPELINE  ──────────────────────────── */

/**
 * Runs the full crew, emitting a CrewEvent per stage transition.
 * Throws CrewError when the scout stage fails (the route reports crew/error).
 * All other agent failures degrade to null intel and the run completes.
 */
export async function runCrewPipeline(
  input: CrewInput,
  emit: (e: CrewEvent) => void,
): Promise<AnalyzeResult> {
  // 1 · scout — fatal on failure
  emit({ agent: "scout", status: "start" });
  let job: JobExtract;
  try {
    job = await runScout(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Scout failed to parse the listing.";
    emit({ agent: "scout", status: "error", message });
    throw new CrewError(message);
  }
  emit({ agent: "scout", status: "done", data: job });

  // 2 · venue — null when unidentifiable, error tolerated
  emit({ agent: "venue", status: "start" });
  let venue: VenueIntel | null = null;
  try {
    venue = await runVenue(job);
    emit({ agent: "venue", status: "done", data: venue });
  } catch (err) {
    emit({
      agent: "venue",
      status: "error",
      message: err instanceof Error ? err.message : "Venue research failed.",
    });
  }

  // 3-5 · menu / people / reviews — parallel, each independently fallible
  const staged = async <T>(
    agent: "menu" | "people" | "reviews",
    fn: () => Promise<T | null>,
  ): Promise<T | null> => {
    emit({ agent, status: "start" });
    try {
      const data = await fn();
      emit({ agent, status: "done", data });
      return data;
    } catch (err) {
      emit({
        agent,
        status: "error",
        message: err instanceof Error ? err.message : `${agent} research failed.`,
      });
      return null;
    }
  };

  const [menuRes, peopleRes, reviewsRes] = await Promise.allSettled([
    staged<MenuIntel>("menu", () => runMenu(job, venue)),
    staged<PeopleIntel>("people", () => runPeople(job, venue)),
    staged<ReviewIntel>("reviews", () => runReviews(job, venue)),
  ]);
  const menu = menuRes.status === "fulfilled" ? menuRes.value : null;
  const people = peopleRes.status === "fulfilled" ? peopleRes.value : null;
  const reviews = reviewsRes.status === "fulfilled" ? reviewsRes.value : null;

  // 6 · synthesis — always produces a Synthesis (internal fallbacks)
  emit({ agent: "synthesis", status: "start" });
  const synthesis = await runSynthesis(job, venue, menu, people, reviews);
  emit({ agent: "synthesis", status: "done", data: synthesis });

  return {
    job,
    venue,
    menu,
    people,
    reviews,
    synthesis,
    analyzedAt: new Date().toISOString(),
  };
}
