/**
 * Craigslist sapi JSON search — the API the CL SPA itself loads.
 * Gives venue name + pay AT INDEX LEVEL (no detail fetch needed).
 *
 * Live-tested 2026-08-03: 216 NYC-wide bartender items. Undocumented API —
 * items are positional arrays mixing scalars and tagged [tagId, value] tuples:
 *   tag 6 = url slug, 7 = pay ("$17-$20hr"), 8 = venue name, 12 = role blurb,
 *   13 = base62 post id; LAST string element = full post title.
 * Post URL = https://www.craigslist.org/view/d/{slug}/{base62Id}.
 * Parse defensively (verify tag ids per item, skip malformed rows).
 *
 * Same datacenter blocking as craigslist.org — isolation handles Vercel 403s.
 */

import type { JobPosting } from "../types";
import { collapseWhitespace, fetchJson, inferBorough } from "../http";

export const name = "craigslist-sapi";

const SAPI_URL =
  "https://sapi.craigslist.org/web/v8/postings/search/full?batch=3-0-360-0-0&cc=US&lang=en&query=bartender&searchPath=fbh";

type SapiItem = unknown[];

interface Parsed {
  slug: string | null;
  pay: string | null;
  venue: string | null;
  blurb: string | null;
  base62: string | null;
  title: string | null;
}

function parseItem(item: SapiItem): Parsed {
  const p: Parsed = { slug: null, pay: null, venue: null, blurb: null, base62: null, title: null };
  for (const el of item) {
    if (Array.isArray(el) && el.length >= 2 && typeof el[0] === "number" && typeof el[1] === "string") {
      const [tag, val] = el as [number, string];
      if (tag === 6) p.slug = val;
      else if (tag === 7) p.pay = val;
      else if (tag === 8) p.venue = val;
      else if (tag === 12) p.blurb = val;
      else if (tag === 13) p.base62 = val;
    }
  }
  const last = item[item.length - 1];
  if (typeof last === "string") p.title = collapseWhitespace(last);
  return p;
}

export async function fetchJobs(): Promise<JobPosting[]> {
  const json = await fetchJson<{ data?: { items?: SapiItem[] } }>(SAPI_URL);
  const items = json?.data?.items;
  if (!Array.isArray(items)) throw new Error("craigslist-sapi: response shape changed (no data.items)");

  const out: JobPosting[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (!Array.isArray(item)) continue;
    const p = parseItem(item);
    if (!p.slug || !p.base62 || !p.title) continue; // can't build a stable URL — skip honestly
    if (seen.has(p.base62)) continue;
    seen.add(p.base62);
    // NYC-wide feed (batch area 3) — borough from the geo-ish slug prefix
    // ("new-york-…" = Manhattan, "brooklyn-…" = Brooklyn, …).
    const borough = inferBorough(p.slug);
    out.push({
      id: `cl-${p.base62}`, // shares the cl- namespace: same post as the HTML lane dedupes by id
      source: name,
      url: `https://www.craigslist.org/view/d/${p.slug}/${p.base62}`,
      title: p.title,
      venueName: p.venue,
      address: null,
      neighborhood: null,
      borough,
      pay: p.pay,
      schedule: null,
      postedAt: null,
      summary: p.blurb ? collapseWhitespace(p.blurb).slice(0, 240) : p.title,
      tags: ["craigslist"],
    });
  }

  if (out.length === 0) throw new Error("craigslist-sapi: 0 items parsed — tuple tags changed or blocked");
  return out;
}
