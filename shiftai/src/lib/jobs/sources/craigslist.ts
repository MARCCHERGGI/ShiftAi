/**
 * Craigslist Manhattan food/bev/hosp — best-effort source, two lanes:
 *
 *  1. Direct index parse of newyork.craigslist.org/search/mnh/fbh?query=bartender
 *     using the CURRENT markup (live-tested 2026-08-03): results are
 *     `<li class="cl-static-search-result" title="...">` and post links moved to
 *     https://www.craigslist.org/view/d/{slug}/{base62Id} — the legacy regex in
 *     src/lib/craigslist.ts parseIndex() matches 0 of these.
 *  2. Wraps the existing verified-listings pipeline (src/lib/craigslist.ts) —
 *     CACHE-ONLY: we surface its LLM-verified listings when a warm cache exists,
 *     but never trigger its 20-30s scrape+classify pass from this hot path.
 *
 * Craigslist 403s from datacenter IPs (Vercel) — the aggregator's failure
 * isolation absorbs that; residential/local runs get the full feed.
 */

import type { JobPosting } from "../types";
import { collapseWhitespace, decodeEntities, fetchText } from "../http";
import { getCacheMeta, getCachedListings } from "../../craigslist";

export const name = "craigslist";

const INDEX_URL = "https://newyork.craigslist.org/search/mnh/fbh?query=bartender";

const LI_RE = /<li class="cl-static-search-result" title="([^"]*)">([\s\S]*?)<\/li>/g;

function parseIndex(html: string): JobPosting[] {
  const out: JobPosting[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  LI_RE.lastIndex = 0;
  while ((m = LI_RE.exec(html)) !== null) {
    const title = collapseWhitespace(decodeEntities(m[1]));
    const block = m[2];
    const href = block.match(/<a[^>]+href="([^"]+)"/)?.[1];
    if (!title || !href) continue;
    // Post id = trailing base62 path segment of /view/d/{slug}/{id}
    const id = href.replace(/\/+$/, "").split("/").pop() ?? "";
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const location = block.match(/<div class="location">\s*([\s\S]*?)\s*<\/div>/)?.[1];
    const neighborhood = location ? collapseWhitespace(decodeEntities(location)) || null : null;
    out.push({
      id: `cl-${id}`,
      source: name,
      url: href,
      title,
      venueName: null,
      address: null,
      neighborhood,
      borough: "Manhattan", // mnh subarea — Manhattan by definition
      pay: null,
      schedule: null,
      postedAt: null, // index page carries no dates in current markup
      summary: neighborhood ? `${title} — ${neighborhood}` : title,
      tags: ["craigslist"],
    });
  }
  return out;
}

/** Map the existing pipeline's LLM-verified listings (cache-only, never scrapes). */
async function verifiedFromCache(): Promise<JobPosting[]> {
  if (!getCacheMeta().hasCache) return [];
  try {
    const result = await getCachedListings(); // warm cache → instant, no network/LLM
    return result.listings.map((l) => ({
      id: `cl-${l.postId}`,
      source: name,
      url: l.url,
      title: l.title,
      venueName: l.venueName,
      address: l.address,
      neighborhood: l.neighborhood,
      borough: "Manhattan",
      pay: l.payHint,
      schedule: l.walkInWindow,
      postedAt: l.postedAt || null,
      summary: l.bodyExcerpt,
      tags: ["craigslist", "verified"],
    }));
  } catch {
    return []; // best-effort lane — direct parse still stands on its own
  }
}

export async function fetchJobs(): Promise<JobPosting[]> {
  const verified = await verifiedFromCache();
  const html = await fetchText(INDEX_URL); // throws on 403 (datacenter) → isolation
  const direct = parseIndex(html);

  // Merge: verified entries are richer (venue/address/pay) — they win on id clash.
  const byId = new Map<string, JobPosting>();
  for (const job of direct) byId.set(job.id, job);
  for (const job of verified) byId.set(job.id, job);
  return [...byId.values()];
}
