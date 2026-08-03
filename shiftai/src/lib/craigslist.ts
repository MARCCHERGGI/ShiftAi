/**
 * Craigslist Manhattan hospitality scraper + scam classifier.
 *
 * Source: https://newyork.craigslist.org/search/mnh/fbh
 *   mnh = Manhattan subarea
 *   fbh = food/beverage/hospitality category
 *
 * Pipeline:
 *   1. fetch index page → parse list of post URLs + titles + post-date
 *   2. for each (rate-limited), fetch detail HTML → extract body, address, post id
 *   3. LLM classifies each as "real" vs "scam" using structured JSON
 *   4. only "real" listings (with address OR explicit walk-in time) are exposed
 *
 * "Real" criteria the classifier enforces:
 *   - has a venue name OR a specific address OR a specific walk-in time
 *   - role is concrete (bartender / server / etc., not "hospitality opportunity")
 *   - no upfront fee, no SSN/bank/photo asks, no off-platform application gates
 *   - pay is plausible for the NYC market (no $45/hr starter bartender)
 */

import { runStructuredExtract } from "./llm";

/* ────────────────────────────────────────────────────────────
   PUBLIC TYPES
   ──────────────────────────────────────────────────────────── */

export type ListingRole =
  | "bartender"
  | "server"
  | "host"
  | "barback"
  | "runner"
  | "busser"
  | "barista"
  | "cook"
  | "dishwasher"
  | "other";

export interface VerifiedListing {
  postId: string;
  title: string;
  url: string;
  postedAt: string;
  scrapedAt: string;
  role: ListingRole;
  venueName: string | null;
  address: string | null;
  neighborhood: string | null;
  walkInWindow: string | null;
  payHint: string | null;
  bodyExcerpt: string;
  whatToBring: string | null;
  contactEmail: string | null;
}

export interface ScrapeResult {
  fetchedAt: string;
  totalIndexed: number;
  totalReal: number;
  totalScams: number;
  listings: VerifiedListing[];
}

/* ────────────────────────────────────────────────────────────
   CRAIGSLIST INDEX
   ──────────────────────────────────────────────────────────── */

const CL_INDEX =
  "https://newyork.craigslist.org/search/mnh/fbh?query=bartender&search_distance=2&postal=10003";
const CL_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

interface IndexEntry {
  postId: string;
  url: string;
  title: string;
  postedAt: string;
}

async function fetchIndex(): Promise<IndexEntry[]> {
  const res = await fetch(CL_INDEX, {
    headers: {
      "user-agent": CL_UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Craigslist index ${res.status}`);
  const html = await res.text();
  return parseIndex(html);
}

function parseIndex(html: string): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const seen = new Set<string>();

  // Craigslist 2024+ markup: each result is in <li class="cl-static-search-result"> with an <a href> and <div class="title">.
  // Plus posted dates as <div class="meta"> with timeago classes.
  // We cast a wide net with multiple regexes since their template flips occasionally.
  const linkRe =
    /<a[^>]+href="(https:\/\/newyork\.craigslist\.org\/mnh\/fbh\/d\/[^"]+\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const url = m[1];
    const postId = m[2];
    if (seen.has(postId)) continue;
    seen.add(postId);
    const inner = m[3].replace(/<[^>]+>/g, "").trim();
    // Craigslist's anchor wraps title + price ($0 placeholder) + subarea — collapse and crop.
    const collapsed = decodeEntities(inner).replace(/\s+/g, " ").trim();
    // Drop trailing "$0 Flatiron" style suffix: anything after the last meaningful word before $/whitespace block.
    const title = collapsed
      .replace(/\s+\$\d+(?:[,.]\d+)?\s+\S+\s*$/, "")
      .slice(0, 200)
      .trim();
    if (!title) continue;
    entries.push({ postId, url, title, postedAt: "" });
  }

  return entries.slice(0, 30); // cap to avoid hammering CL
}

/* ────────────────────────────────────────────────────────────
   CRAIGSLIST DETAIL
   ──────────────────────────────────────────────────────────── */

interface DetailExtract {
  body: string;
  address: string | null;
  postedAt: string;
  contactEmail: string | null;
  payHint: string | null;
}

async function fetchDetail(url: string): Promise<DetailExtract> {
  const res = await fetch(url, {
    headers: {
      "user-agent": CL_UA,
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9",
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Detail ${res.status} for ${url}`);
  const html = await res.text();
  return parseDetail(html);
}

function parseDetail(html: string): DetailExtract {
  const bodyMatch = html.match(
    /<section[^>]*id="postingbody"[^>]*>([\s\S]*?)<\/section>/i,
  );
  const rawBody = bodyMatch?.[1] ?? "";
  // Strip "QR Code link to This Post" header CL wraps around body
  const cleanedBody = rawBody
    .replace(/<div class="print-qrcode-container">[\s\S]*?<\/div>/i, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const body = decodeEntities(cleanedBody);

  // Map address (when poster pinned a location)
  const addrMatch =
    html.match(/<div class="mapaddress">([\s\S]*?)<\/div>/i) ||
    html.match(/<small>\(google map\)<\/small>\s*<\/p>\s*<p>([^<]+)<\/p>/i);
  const address = addrMatch ? decodeEntities(addrMatch[1].replace(/<[^>]+>/g, "").trim()) : null;

  // Posted date (datetime attribute)
  const postedMatch = html.match(/<time[^>]+datetime="([^"]+)"/i);
  const postedAt = postedMatch?.[1] ?? new Date().toISOString();

  // Compensation block CL puts above body for paid listings
  const payMatch = html.match(/compensation:\s*<\/b>\s*([^<\n]+)/i);
  const payHint = payMatch ? payMatch[1].trim() : null;

  // Email obfuscation — CL hides actual reply addresses behind a redirector,
  // so we only catch unobfuscated @-strings the poster left in body.
  const emailMatch = body.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  const contactEmail = emailMatch?.[0] ?? null;

  return { body, address, postedAt, contactEmail, payHint };
}

/* ────────────────────────────────────────────────────────────
   CLASSIFIER
   ──────────────────────────────────────────────────────────── */

const CLASSIFY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    isReal: { type: "boolean" },
    scamReason: { type: "string" },
    role: {
      type: "string",
      enum: [
        "bartender",
        "server",
        "host",
        "barback",
        "runner",
        "busser",
        "barista",
        "cook",
        "dishwasher",
        "other",
      ],
    },
    venueName: { type: "string" },
    address: { type: "string" },
    neighborhood: { type: "string" },
    walkInWindow: { type: "string" },
    whatToBring: { type: "string" },
    bodyExcerpt: { type: "string" },
  },
  required: [
    "isReal",
    "scamReason",
    "role",
    "venueName",
    "address",
    "neighborhood",
    "walkInWindow",
    "whatToBring",
    "bodyExcerpt",
  ],
} as const;

interface ClassifyOutput {
  isReal: boolean;
  scamReason: string;
  role: ListingRole;
  venueName: string;
  address: string;
  neighborhood: string;
  walkInWindow: string;
  whatToBring: string;
  bodyExcerpt: string;
}

async function classifyListing(args: {
  title: string;
  body: string;
  postedAddress: string | null;
}): Promise<ClassifyOutput> {
  const today = new Date();
  const todayLabel = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const systemPrompt = `Today is ${todayLabel}.

You verify Craigslist NYC food/beverage/hospitality job posts. For each post, decide whether it is REAL (a NYC venue actually hiring with concrete walk-in or interview details) or a SCAM/spam (vague, fee-asking, off-platform redirect, unrealistic pay, identity-theft pattern).

REAL must satisfy at least 2 of:
- Names a specific venue (or describes it concretely: "our Lower East Side cocktail bar at 123 Avenue A")
- Lists a street address OR clear cross streets
- States when to walk in OR when to come for interview (with a specific day/time or window)
- Lists a concrete role with concrete shifts/hours
- Mentions plausible NYC pay ($16–$30/hr base for entry roles; tipped roles often "plus tips")

SCAM markers (any one is enough to mark scam):
- Asks for fee, registration, training cost upfront
- Asks to send SSN, bank info, or photo ID before interview
- Pay too high for role ($40+/hr starter bartender, $30/hr busser)
- Generic "established restaurant in Manhattan" with no specifics, repeated reposts
- Off-platform funnel (fill out at random URL, "text our HR app")
- Promises remote work / "$$$ daily" / multi-level recruiting tone
- Asks for "models / cocktail server / promotional" with photo + measurements
- Body is mostly hashtags or emojis

For REAL listings, extract:
- role (one of bartender/server/host/barback/runner/busser/barista/cook/dishwasher/other)
- venueName: best guess from body, or "" if not stated
- address: full address if stated, else "" (DO NOT invent)
- neighborhood: NYC neighborhood the address falls in (East Village, LES, Midtown East, etc.) or ""
- walkInWindow: e.g. "Tue–Thu 2–4 PM" or "Walk in any afternoon" — only if explicitly stated AND the window is on or after today's date. If the post names a specific past date (e.g. "Thursday 4/16" when today is later), set walkInWindow to "" — never present a past date as upcoming. Recurring weekday/weekly windows ("Tue-Thu 2-4 PM") are fine.
- whatToBring: e.g. "resume + photo ID" — only if stated, else ""
- bodyExcerpt: 2-sentence plain-English summary of the listing, recruiter tone

For SCAM, set isReal=false and scamReason="<one short reason>", leave other fields as "".

Return ONLY JSON matching the schema. No markdown.`;

  const userPrompt = [
    `Title: ${args.title}`,
    args.postedAddress ? `Posted address: ${args.postedAddress}` : "",
    "",
    "Body:",
    args.body.slice(0, 4000),
  ]
    .filter(Boolean)
    .join("\n");

  const result = await runStructuredExtract<ClassifyOutput>({
    systemPrompt,
    userPrompt,
    schema: CLASSIFY_SCHEMA as object,
    maxTokens: 700,
  });
  return result;
}

/* ────────────────────────────────────────────────────────────
   PUBLIC ENTRY — scrape + classify everything
   ──────────────────────────────────────────────────────────── */

export async function scrapeAndClassify(opts?: {
  maxListings?: number;
  onProgress?: (event: { stage: string; index?: number; total?: number }) => void;
}): Promise<ScrapeResult> {
  const max = opts?.maxListings ?? 18;
  opts?.onProgress?.({ stage: "index" });
  const index = (await fetchIndex()).slice(0, max);

  const listings: VerifiedListing[] = [];
  let scams = 0;

  for (let i = 0; i < index.length; i++) {
    const entry = index[i];
    opts?.onProgress?.({ stage: "detail", index: i + 1, total: index.length });
    try {
      // gentle pacing — Craigslist throttles aggressive scrapers
      if (i > 0) await sleep(550);
      const detail = await fetchDetail(entry.url);
      if (!detail.body || detail.body.length < 60) continue;

      const cls = await classifyListing({
        title: entry.title,
        body: detail.body,
        postedAddress: detail.address,
      });

      if (!cls.isReal) {
        scams++;
        continue;
      }

      // Hard role filter — the product is bartender jobs only.
      // Craigslist's category search bleeds (servers / barbacks / cooks) so we
      // gate again on the classifier's extracted role.
      if (cls.role !== "bartender") {
        continue;
      }

      const finalAddress = cls.address?.trim() || detail.address?.trim() || null;
      const hasEnough =
        Boolean(finalAddress) ||
        Boolean(cls.walkInWindow?.trim()) ||
        Boolean(cls.venueName?.trim());
      if (!hasEnough) {
        scams++;
        continue;
      }

      const cleanedWindow = stripStaleDates(cls.walkInWindow?.trim() || null);

      listings.push({
        postId: entry.postId,
        title: entry.title,
        url: entry.url,
        postedAt: detail.postedAt,
        scrapedAt: new Date().toISOString(),
        role: cls.role,
        venueName: cls.venueName?.trim() || null,
        address: finalAddress,
        neighborhood: cls.neighborhood?.trim() || null,
        walkInWindow: cleanedWindow,
        payHint: detail.payHint,
        bodyExcerpt: cls.bodyExcerpt?.trim() || detail.body.slice(0, 240),
        whatToBring: cls.whatToBring?.trim() || null,
        contactEmail: detail.contactEmail,
      });
    } catch (err) {
      // skip and continue — one bad detail page shouldn't kill the whole pass
      console.warn(`[craigslist] skipped ${entry.postId}:`, err);
    }
  }

  opts?.onProgress?.({ stage: "done", total: index.length });

  return {
    fetchedAt: new Date().toISOString(),
    totalIndexed: index.length,
    totalReal: listings.length,
    totalScams: scams,
    listings,
  };
}

/* ────────────────────────────────────────────────────────────
   IN-MEMORY CACHE
   ──────────────────────────────────────────────────────────── */

const CACHE_TTL_MS = 60 * 60 * 1000;

interface Cached {
  result: ScrapeResult;
  cachedAt: number;
}

let cache: Cached | null = null;
let inFlight: Promise<ScrapeResult> | null = null;

export async function getCachedListings(opts?: { force?: boolean }): Promise<ScrapeResult> {
  if (!opts?.force && cache && Date.now() - cache.cachedAt < CACHE_TTL_MS) {
    return cache.result;
  }
  if (inFlight) return inFlight;

  inFlight = scrapeAndClassify()
    .then((result) => {
      cache = { result, cachedAt: Date.now() };
      return result;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function getCacheMeta(): { hasCache: boolean; ageMs: number } {
  return {
    hasCache: cache !== null,
    ageMs: cache ? Date.now() - cache.cachedAt : Infinity,
  };
}

/* ────────────────────────────────────────────────────────────
   UTIL
   ──────────────────────────────────────────────────────────── */

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Drops walkInWindow strings that reference only past dates.
 *
 * LLM still occasionally lets stale dates through (e.g. "Tuesday 4/21/26 2PM to
 * 4PM" when today is 4/28/26). We sweep numeric M/D[/YY] patterns and, if EVERY
 * specific date in the string has already passed, drop the whole field. Strings
 * with no specific dates ("Tue-Thu 2-4 PM") are recurring and pass through
 * untouched.
 */
function stripStaleDates(window: string | null): string | null {
  if (!window) return null;
  const dateRe = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g;
  const matches = [...window.matchAll(dateRe)];
  if (matches.length === 0) return window;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  let anyFuture = false;
  for (const m of matches) {
    const month = parseInt(m[1], 10) - 1;
    const day = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    if (year < 100) year += 2000;
    const d = new Date(year, month, day);
    if (d.getTime() >= now.getTime()) {
      anyFuture = true;
      break;
    }
  }
  return anyFuture ? window : null;
}
