import { NextRequest, NextResponse } from "next/server";
import { cacheGet, cacheSet } from "@/src/lib/cache";
import { enforceLimit, rateLimitResponse } from "@/src/lib/ratelimit";

export const runtime = "nodejs";
export const maxDuration = 20;

type Listing = {
  id: string;
  title: string;
  url: string;
  neighborhood?: string;
  postedAt: number;
  snippet?: string;
  source: "craigslist";
  city: string;
};

const CITIES: Record<string, string> = {
  newyork:      "newyork.craigslist.org",
  losangeles:   "losangeles.craigslist.org",
  chicago:      "chicago.craigslist.org",
  sfbay:        "sfbay.craigslist.org",
  boston:       "boston.craigslist.org",
  washingtondc: "washingtondc.craigslist.org",
  seattle:      "seattle.craigslist.org",
  austin:       "austin.craigslist.org",
  denver:       "denver.craigslist.org",
  miami:        "miami.craigslist.org",
  atlanta:      "atlanta.craigslist.org",
  portland:     "portland.craigslist.org",
  philadelphia: "philadelphia.craigslist.org",
  sandiego:     "sandiego.craigslist.org",
  houston:      "houston.craigslist.org",
  dallas:       "dallas.craigslist.org",
  neworleans:   "neworleans.craigslist.org",
  nashville:    "nashville.craigslist.org",
};

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 " +
  "(KHTML, like Gecko) Version/17.5 Safari/605.1.15";

const memCache = new Map<string, { data: Listing[]; expires: number }>();

export async function GET(req: NextRequest) {
  const rl = await enforceLimit(req, "track");
  if (!rl.ok) return rateLimitResponse(rl);

  const sp = req.nextUrl.searchParams;
  const city = (sp.get("city") || "newyork").toLowerCase();
  const query = (sp.get("q") || "bartender").slice(0, 80);
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "25", 10)));

  try {
    const listings = await fetchListings(city, query);
    return NextResponse.json(
      { listings: listings.slice(0, limit), city, query, source: "craigslist", cachedAt: Date.now() },
      { headers: { "cache-control": "public, max-age=300, s-maxage=600" } }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "fetch failed",
        listings: [],
        hint: "Craigslist often blocks datacenter IPs. Try the city/term again in a minute.",
      },
      { status: 502 }
    );
  }
}

async function fetchListings(city: string, query: string): Promise<Listing[]> {
  const key = `listings:${city}:${query.toLowerCase()}`;

  const mem = memCache.get(key);
  if (mem && mem.expires > Date.now()) return mem.data;

  const up = await cacheGet<Listing[]>(key);
  if (up && up.length > 0) {
    memCache.set(key, { data: up, expires: Date.now() + 5 * 60_000 });
    return up;
  }

  const host = CITIES[city] || CITIES.newyork;

  // Try three strategies in order. First one to yield results wins.
  const strategies = [
    () => fetchHtml(host, query, city),     // most forgiving — HTML search page
    () => fetchJson(host, query, city),     // structured JSON endpoint
    () => fetchRss(host, query, city),      // RSS feed
  ];

  let lastErr: unknown = null;
  for (const strat of strategies) {
    try {
      const out = await strat();
      if (out.length > 0) {
        memCache.set(key, { data: out, expires: Date.now() + 10 * 60_000 });
        await cacheSet(key, out, 60 * 10);
        return out;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error("all strategies failed");
}

// Subarea path — for NYC we constrain to Manhattan only. Goes AFTER /search/.
function subSeg(city: string): string {
  return city === "newyork" ? "mnh/" : "";
}

/* ── Strategy 1: HTML ──────────────────────────────── */

async function fetchHtml(host: string, query: string, city: string): Promise<Listing[]> {
  const url = `https://${host}/search/${subSeg(city)}fbh?query=${encodeURIComponent(query)}&sort=date`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`HTML ${res.status}`);
  const html = await res.text();
  return parseHtml(html, city);
}

function parseHtml(html: string, city: string): Listing[] {
  const items: Listing[] = [];
  // Craigslist 2023+ layout: <li class="cl-search-result cl-search-view-mode-list">...
  // Each has an <a class="posting-title" href="..."> with <span class="label">TITLE</span>
  // Plus <div class="meta"> with posted time, and <div class="location">
  const itemRe = /<li[^>]*class="[^"]*cl-search-result[^"]*"[^>]*data-pid="(\d+)"[\s\S]*?<\/li>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(html)) !== null) {
    const block = m[0];
    const id = m[1];

    const hrefMatch  = block.match(/<a[^>]*class="[^"]*posting-title[^"]*"[^>]*href="([^"]+)"/);
    const titleMatch = block.match(/<span[^>]*class="[^"]*label[^"]*"[^>]*>([\s\S]*?)<\/span>/);
    const locMatch   = block.match(/<div[^>]*class="[^"]*location[^"]*"[^>]*>([\s\S]*?)<\/div>/);
    const timeMatch  = block.match(/<span[^>]*class="[^"]*meta[^"]*"[^>]*title="([^"]+)"/)
                    || block.match(/<time[^>]*datetime="([^"]+)"/);

    const url = hrefMatch ? decodeHtml(hrefMatch[1]) : "";
    const title = titleMatch ? stripHtml(titleMatch[1]) : "";
    if (!url || !title) continue;

    const neighborhood = locMatch ? stripHtml(locMatch[1]) : undefined;
    const postedAt = timeMatch ? new Date(timeMatch[1]).getTime() || Date.now() : Date.now();

    items.push({ id, title, url, neighborhood, postedAt, source: "craigslist", city });
  }
  return items;
}

/* ── Strategy 2: JSON ──────────────────────────────── */

async function fetchJson(host: string, query: string, city: string): Promise<Listing[]> {
  const url = `https://${host}/jsonsearch/${subSeg(city)}fbh?query=${encodeURIComponent(query)}&sort=date`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/json, text/javascript, */*; q=0.01",
      "Accept-Language": "en-US,en;q=0.9",
      "X-Requested-With": "XMLHttpRequest",
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`JSON ${res.status}`);
  const raw = await res.text();
  const data: unknown = JSON.parse(raw);
  const arr = Array.isArray(data) && Array.isArray(data[0]) ? (data[0] as unknown[]) : [];

  const items: Listing[] = [];
  for (const entry of arr) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const title = String(e.PostingTitle || "");
    const postUrl = String(e.PostingURL || "");
    const id = String(e.PostingID || Math.random().toString(36).slice(2));
    if (!title || !postUrl) continue;

    const parenMatch = title.match(/\(([^)]+)\)\s*$/);
    items.push({
      id,
      title: title.replace(/\s*\([^)]+\)\s*$/, "").trim(),
      url: postUrl,
      neighborhood: parenMatch ? parenMatch[1].trim() : undefined,
      postedAt: typeof e.PostedDate === "string" ? Number(e.PostedDate) * 1000 : Date.now(),
      source: "craigslist",
      city,
    });
  }
  return items;
}

/* ── Strategy 3: RSS ──────────────────────────────── */

async function fetchRss(host: string, query: string, city: string): Promise<Listing[]> {
  const url = `https://${host}/search/${subSeg(city)}fbh?query=${encodeURIComponent(query)}&sort=date&format=rss`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      "Accept": "application/rss+xml, application/xml, text/xml, */*; q=0.9",
      "Accept-Language": "en-US,en;q=0.9",
    },
    next: { revalidate: 600 },
  });
  if (!res.ok) throw new Error(`RSS ${res.status}`);
  const xml = await res.text();
  return parseRss(xml, city);
}

function parseRss(xml: string, city: string): Listing[] {
  const items: Listing[] = [];
  const itemRe = /<item[^>]*?(?:\s+rdf:about="([^"]+)")?[^>]*>([\s\S]*?)<\/item>/g;
  let m: RegExpExecArray | null;

  while ((m = itemRe.exec(xml)) !== null) {
    const aboutUrl = decodeHtml(m[1] || "");
    const body = m[2];

    const title       = extract(body, /<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const link        = extract(body, /<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/) || aboutUrl;
    const description = extract(body, /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const date        = extract(body, /<dc:date>([\s\S]*?)<\/dc:date>/)
                     || extract(body, /<pubDate>([\s\S]*?)<\/pubDate>/);
    const href = link || aboutUrl;
    if (!href || !title) continue;

    const idMatch = href.match(/\/(\d{8,})\.html/);
    const id = idMatch ? idMatch[1] : `${city}-${items.length}-${Date.now()}`;
    const parenMatch = title.match(/\(([^)]+)\)\s*$/);

    items.push({
      id,
      title: title.replace(/\s*\([^)]+\)\s*$/, "").trim(),
      url: href,
      neighborhood: parenMatch ? parenMatch[1].trim() : undefined,
      postedAt: date ? new Date(date).getTime() || Date.now() : Date.now(),
      snippet: description ? stripHtml(description).slice(0, 240) : undefined,
      source: "craigslist",
      city,
    });
  }
  return items;
}

/* ── helpers ───────────────────────────────────────── */

function extract(s: string, re: RegExp): string {
  const m = s.match(re);
  return m ? decodeHtml(m[1].trim()) : "";
}
function stripHtml(s: string): string {
  return decodeHtml(s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}
function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}
