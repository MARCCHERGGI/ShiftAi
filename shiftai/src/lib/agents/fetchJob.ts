/**
 * Server-side job-listing fetcher for the agent crew.
 *
 * Fetches a job URL with a desktop UA, follows redirects, 10s timeout,
 * strips HTML down to clean listing text. Knows the DOM quirks of
 * craigslist and indeed; falls back to a generic main/article/body strip.
 *
 * Throws JobFetchError on any failure so the analyze route can report a
 * typed, user-actionable error (the client then asks the user to paste
 * the listing text instead).
 */

const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 10_000;
/** Cap on the cleaned text handed to the LLM stage. */
const MAX_TEXT_CHARS = 9_000;

export type JobFetchErrorCode =
  | "invalid-url" // not an http(s) URL
  | "timeout" // did not respond within 10s
  | "network" // DNS / connection failure
  | "http" // non-2xx status (403/404/410/...)
  | "blocked" // fetched OK but the page is a bot-wall / captcha
  | "empty"; // fetched OK but no meaningful listing text found

export class JobFetchError extends Error {
  readonly code: JobFetchErrorCode;
  readonly status?: number;

  constructor(code: JobFetchErrorCode, message: string, status?: number) {
    super(message);
    this.name = "JobFetchError";
    this.code = code;
    this.status = status;
  }
}

export interface FetchedJob {
  /** Final URL after redirects. */
  url: string;
  /** "craigslist" | "indeed" | "culinary agents" | hostname */
  source: string;
  /** Cleaned plain text of the listing (title + body + attributes). */
  text: string;
}

/* ────────────────────────────  PUBLIC  ──────────────────────────── */

export async function fetchJobText(rawUrl: string): Promise<FetchedJob> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    throw new JobFetchError("invalid-url", "That doesn't look like a valid link.");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new JobFetchError("invalid-url", "Only http(s) links are supported.");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(parsed.toString(), {
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "user-agent": DESKTOP_UA,
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "upgrade-insecure-requests": "1",
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new JobFetchError(
        "timeout",
        "The listing page took too long to respond (10s). Paste the listing text instead.",
      );
    }
    throw new JobFetchError(
      "network",
      "Couldn't reach that page. Check the link, or paste the listing text instead.",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new JobFetchError(
      "http",
      `The listing page returned ${res.status}. It may be expired or blocking bots — paste the listing text instead.`,
      res.status,
    );
  }

  const html = await res.text();
  const finalUrl = res.url || parsed.toString();
  const host = hostnameOf(finalUrl);
  const source = sourceFromHost(host);

  if (looksBlocked(html)) {
    throw new JobFetchError(
      "blocked",
      `${source} is blocking automated access to this page. Paste the listing text instead.`,
    );
  }

  const text = extractListingText(html, source);

  if (text.replace(/\s+/g, " ").trim().length < 80) {
    throw new JobFetchError(
      "empty",
      "Couldn't find listing text on that page. It may be expired — paste the listing text instead.",
    );
  }

  return { url: finalUrl, source, text: text.slice(0, MAX_TEXT_CHARS) };
}

/* ────────────────────────────  SOURCE DETECTION  ──────────────────────────── */

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function sourceFromHost(host: string): string {
  if (host.includes("craigslist.org")) return "craigslist";
  if (host.includes("indeed.com")) return "indeed";
  if (host.includes("culinaryagents.com")) return "culinary agents";
  return host.replace(/^www\./, "") || "web";
}

function looksBlocked(html: string): boolean {
  const head = html.slice(0, 4000).toLowerCase();
  return (
    head.includes("just a moment...") || // cloudflare interstitial
    head.includes("cf-challenge") ||
    head.includes("verify you are a human") ||
    head.includes("access to this page has been denied") || // perimeterx (indeed)
    head.includes("px-captcha") ||
    head.includes("this posting has been flagged for removal")
  );
}

/* ────────────────────────────  HTML → TEXT  ──────────────────────────── */

function extractListingText(html: string, source: string): string {
  if (source === "craigslist") {
    const cl = extractCraigslist(html);
    if (cl) return cl;
  }
  if (source === "indeed") {
    const ind = extractIndeed(html);
    if (ind) return ind;
  }
  return extractGeneric(html);
}

function extractCraigslist(html: string): string | null {
  const parts: string[] = [];

  const title =
    firstMatch(html, /<span[^>]+id="titletextonly"[^>]*>([\s\S]*?)<\/span>/i) ??
    firstMatch(html, /<title>([\s\S]*?)<\/title>/i);
  if (title) parts.push(stripTags(title));

  const body = firstMatch(html, /<section[^>]+id="postingbody"[^>]*>([\s\S]*?)<\/section>/i);
  if (!body) return null;
  // Drop the "QR Code Link to This Post" print-only block craigslist embeds.
  const cleanedBody = body.replace(
    /<div[^>]+class="[^"]*print-information[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    "",
  );
  parts.push(stripTags(cleanedBody));

  // Attribute groups carry pay / employment type / venue address.
  const attrs = allMatches(html, /<p[^>]+class="[^"]*attrgroup[^"]*"[^>]*>([\s\S]*?)<\/p>/gi)
    .concat(allMatches(html, /<div[^>]+class="[^"]*attrgroup[^"]*"[^>]*>([\s\S]*?)<\/div>/gi))
    .map(stripTags)
    .filter(Boolean);
  if (attrs.length) parts.push(attrs.join("\n"));

  const mapAddress = firstMatch(html, /<div[^>]+class="[^"]*mapaddress[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (mapAddress) parts.push(`Address: ${stripTags(mapAddress)}`);

  return parts.join("\n\n").trim() || null;
}

function extractIndeed(html: string): string | null {
  const parts: string[] = [];
  const title =
    firstMatch(html, /<h1[^>]*jobsearch-JobInfoHeader-title[^>]*>([\s\S]*?)<\/h1>/i) ??
    firstMatch(html, /<title>([\s\S]*?)<\/title>/i);
  if (title) parts.push(stripTags(title));

  const body = firstMatch(html, /<div[^>]+id="jobDescriptionText"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)
    ?? firstMatch(html, /<div[^>]+id="jobDescriptionText"[^>]*>([\s\S]*?)<\/div>/i);
  if (!body) return null;
  parts.push(stripTags(body));
  return parts.join("\n\n").trim() || null;
}

function extractGeneric(html: string): string {
  const title = firstMatch(html, /<title>([\s\S]*?)<\/title>/i);
  const scoped =
    firstMatch(html, /<main[\s>][\s\S]*?<\/main>/i) ??
    firstMatch(html, /<article[\s>][\s\S]*?<\/article>/i) ??
    firstMatch(html, /<body[\s>][\s\S]*?<\/body>/i) ??
    html;
  const text = stripTags(scoped);
  return [title ? stripTags(title) : "", text].filter(Boolean).join("\n\n").trim();
}

/* ────────────────────────────  STRIP HELPERS  ──────────────────────────── */

function firstMatch(html: string, re: RegExp): string | null {
  const m = re.exec(html);
  if (!m) return null;
  // Group 1 when captured, whole match otherwise (main/article/body scans).
  return m[1] ?? m[0];
}

function allMatches(html: string, re: RegExp): string[] {
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) out.push(m[1] ?? m[0]);
  return out;
}

function stripTags(fragment: string): string {
  const noScripts = fragment
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<template[\s\S]*?<\/template>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  const withBreaks = noScripts
    .replace(/<\/(p|div|li|tr|h[1-6]|section|article|br)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[\s>]/gi, "\n- <li ");
  const noTags = withBreaks.replace(/<[^>]+>/g, " ");
  return decodeEntities(noTags)
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&bull;/gi, "•")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const n = Number(code);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const n = parseInt(hex, 16);
      return Number.isFinite(n) && n > 0 && n < 0x10ffff ? String.fromCodePoint(n) : " ";
    });
}
