/**
 * Shared fetch + parse helpers for job-source adapters.
 * Every outbound fetch: desktop UA, 10s hard timeout, throws on non-2xx —
 * the aggregator's Promise.allSettled provides per-source failure isolation.
 */

export const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36";

const TIMEOUT_MS = 10_000;

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent": DESKTOP_UA,
      accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return res.text();
}

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "user-agent": DESKTOP_UA,
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
    },
    cache: "no-store",
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  return (await res.json()) as T;
}

export function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&bull;/g, "·")
    .replace(/&middot;/g, "·")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

/**
 * Best-effort borough from free text (address, location line, url slug).
 * "New York, NY" / "New York, New York" without another borough marker → Manhattan.
 * No signal at all → "New York" (NYC, borough unknown).
 */
export function inferBorough(...parts: (string | null | undefined)[]): string {
  const text = parts.filter(Boolean).join(" ").toLowerCase();
  if (!text) return "New York";
  if (/brooklyn|dumbo|williamsburg|bushwick|bed[- ]?stuy|greenpoint|park slope/.test(text))
    return "Brooklyn";
  if (/queens|astoria|long island city|\blic\b|flushing|ridgewood|jackson heights/.test(text))
    return "Queens";
  if (/staten island/.test(text)) return "Staten Island";
  if (/\bbronx\b/.test(text)) return "Bronx";
  if (/manhattan|new york,? n\.?y\.?|new york,? new york|\bnyc\b|\b100\d{2}\b|\bnew[- ]york\b/.test(text))
    return "Manhattan";
  return "New York";
}

/** Compact Manhattan zip → neighborhood map (best-known zips only). */
const ZIP_NEIGHBORHOODS: Record<string, string> = {
  "10001": "Chelsea",
  "10002": "Lower East Side",
  "10003": "East Village",
  "10004": "Financial District",
  "10005": "Financial District",
  "10006": "Financial District",
  "10007": "Tribeca",
  "10009": "East Village",
  "10010": "Gramercy",
  "10011": "Chelsea",
  "10012": "SoHo",
  "10013": "Tribeca",
  "10014": "West Village",
  "10016": "Murray Hill",
  "10017": "Midtown East",
  "10018": "Garment District",
  "10019": "Midtown West",
  "10021": "Upper East Side",
  "10022": "Midtown East",
  "10023": "Upper West Side",
  "10024": "Upper West Side",
  "10025": "Upper West Side",
  "10026": "Harlem",
  "10027": "Harlem",
  "10028": "Upper East Side",
  "10029": "East Harlem",
  "10036": "Theater District",
  "10038": "Financial District",
  "10065": "Upper East Side",
  "10075": "Upper East Side",
  "10128": "Upper East Side",
  "10280": "Battery Park City",
  "10282": "Battery Park City",
};

export function neighborhoodFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const zip = text.match(/\b(10\d{3})\b/);
  return zip ? (ZIP_NEIGHBORHOODS[zip[1]] ?? null) : null;
}

export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}
