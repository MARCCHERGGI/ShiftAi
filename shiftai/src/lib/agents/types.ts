/**
 * Shared contracts for the Shift AI agent crew.
 * Every agent, API route, and page codes against THESE shapes.
 * Do not fork or duplicate these types.
 */

/* ── Agent crew keys ─────────────────────────────── */

export type AgentKey =
  | "scout" // fetches + parses the job link
  | "venue" // identifies the restaurant/bar
  | "menu" // menu + cocktail program research
  | "people" // staff / management / ownership history
  | "reviews" // customer review signal
  | "synthesis"; // merges everything into the walk-in plan

export type AgentStatus = "idle" | "running" | "done" | "error";

/* ── Stage outputs ───────────────────────────────── */

export interface JobExtract {
  url: string | null;
  source: string; // "craigslist" | "indeed" | "culinary agents" | "pasted text" | hostname
  title: string;
  role: string; // "bartender" | "barback" | "server" | ...
  venueName: string | null; // null when the listing hides the venue
  venueAddress: string | null;
  neighborhood: string | null;
  pay: string | null;
  schedule: string | null;
  requirements: string[];
  perks: string[];
  redFlags: string[]; // scam signals in the listing itself
  rawText: string; // cleaned listing text (truncated ~6k chars)
}

export interface VenueIntel {
  name: string;
  confidence: "high" | "medium" | "low";
  kind: string; // "cocktail bar" | "rooftop" | "neighborhood dive" | ...
  vibe: string; // one-sentence read of the room
  address: string | null;
  neighborhood: string | null;
  hospitalityGroup: string | null;
  priceLevel: string | null; // "$" ... "$$$$"
  links: { label: string; url: string }[];
  summary: string;
}

export interface MenuIntel {
  summary: string;
  signatureItems: string[]; // dishes worth knowing by name
  cocktails: string[]; // signature / house cocktails
  spiritsFocus: string | null; // "agave-forward", "whiskey bar", ...
  beerWine: string | null;
  talkingPoints: string[]; // menu-specific things to say in the interview
}

export interface PeopleIntel {
  summary: string;
  owners: string[];
  management: string[]; // GM, bar director, head chef when findable
  history: string; // opened when, previous concepts, expansions
  turnoverSignals: string[]; // churn, lawsuits, press about culture (empty = none found)
  talkingPoints: string[];
}

export interface ReviewIntel {
  summary: string;
  rating: string | null; // "4.4 on Google" style, null when not found
  praise: string[]; // recurring positive themes
  complaints: string[]; // recurring negative themes
  serviceNotes: string[]; // what reviewers say about STAFF specifically
  talkingPoints: string[];
}

export interface Synthesis {
  brief: string; // 2-3 sentence "here's the play"
  fitScore: number; // 0-100 how strong this venue is for the candidate
  walkInPlan: string[]; // ordered, concrete prep steps
  talkingPoints: string[]; // best cross-agent talking points, deduped
  questionsToAsk: string[]; // smart questions for the interviewer
  redFlags: string[]; // listing + venue red flags merged (empty = clean)
}

export interface AnalyzeResult {
  job: JobExtract;
  venue: VenueIntel | null; // null when venue could not be identified
  menu: MenuIntel | null;
  people: PeopleIntel | null;
  reviews: ReviewIntel | null;
  synthesis: Synthesis;
  analyzedAt: string; // ISO
}

/* ── SSE protocol for /api/agents/analyze ────────── */
/* Each SSE message is `data: <JSON CrewEvent>\n\n`.  */

export interface CrewEvent {
  agent: AgentKey | "crew";
  status: "start" | "done" | "error" | "complete";
  /** present on done: that agent's stage output; on crew/complete: AnalyzeResult */
  data?: unknown;
  /** present on error */
  message?: string;
}

/* ── Profile (localStorage: "shiftai.profile") ───── */

export interface Profile {
  name: string;
  email: string;
  phone: string;
  neighborhood: string;
  role: string; // target role, default "Bartender"
  yearsExperience: string;
  workHistory: { place: string; role: string; time: string; highlights: string }[];
  skills: string[]; // POS systems, high-volume, craft cocktails...
  certs: string[]; // TIPS, NYC Food Protection...
  signatureDrinks: string[];
  languages: string[];
  summary: string; // free-text self description
}

/* ── Resume API: POST /api/agents/resume ─────────── */

export interface ResumeRequest {
  profile: Profile;
  analysis: AnalyzeResult | null; // tailors to venue when present
}

export interface ResumeDoc {
  headline: string;
  summary: string;
  experience: { place: string; role: string; time: string; bullets: string[] }[];
  skills: string[];
  certs: string[];
  extras: string[]; // signature drinks, languages, anything venue-relevant
  tailoredTo: string | null; // venue name when tailored
}

export interface ResumeResponse {
  ok: boolean;
  resume?: ResumeDoc;
  error?: string;
}
/* PDF: POST /api/agents/resume with {profile, analysis, resume, format:"pdf"}
   → application/pdf bytes. */

/* ── Interview API: POST /api/agents/interview ───── */

export interface InterviewTurn {
  question: string;
  answer: string;
  score: number; // 0-10
  feedback: string;
}

export interface InterviewRequest {
  profile: Profile | null;
  analysis: AnalyzeResult | null; // venue-specific questions when present
  history: InterviewTurn[]; // completed turns
  pendingQuestion: string | null; // the question the user is answering now
  answer: string | null; // null on first call → returns first question
}

export interface InterviewResponse {
  ok: boolean;
  /** feedback + score for the answer just submitted (absent on first call) */
  scored?: { score: number; feedback: string };
  /** next question to ask; absent when done */
  question?: string;
  /** total questions in this session (fixed, 6) */
  total: number;
  done: boolean;
  /** present when done */
  summary?: { overallScore: number; verdict: string; tips: string[] };
  error?: string;
}

/* ── localStorage keys ───────────────────────────── */

export const LS_PROFILE = "shiftai.profile";
export const LS_ANALYSIS = "shiftai.lastAnalysis";
