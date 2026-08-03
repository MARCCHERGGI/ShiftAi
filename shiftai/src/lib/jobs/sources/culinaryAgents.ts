/**
 * Culinary Agents — THE primary NYC hospitality board (Major Food Group, Boulud,
 * USHG etc. post here instead of running their own ATS).
 *
 * Live-tested recipe (research/job-sources.json, 2026-08-03):
 *   - Search page is server-rendered Rails HTML; 24 cards/page.
 *   - Pagination is `&offset=24/48/...` ONLY — `page=` params are silently ignored.
 *   - Each card anchor carries venue + title + jobid as data-attributes; pay,
 *     hospitality group, street address and a "Posted N days ago" tag sit in
 *     sibling divs within the card block.
 *   - Cloudflare fronted, no challenge to plain fetch with a desktop UA
 *     (datacenter behavior unverified — failure isolation covers a block).
 */

import type { JobPosting } from "../types";
import {
  collapseWhitespace,
  decodeEntities,
  fetchText,
  inferBorough,
  neighborhoodFromText,
} from "../http";

export const name = "culinary-agents";

const BASE =
  "https://culinaryagents.com/search/jobs?search%5Bname%5D=Bartender&search%5Blocation%5D=New%20York%2C%20NY";
const PAGE_SIZE = 24;
const MAX_OFFSET = 240; // safety cap: 11 pages ≈ 264 cards, well past the ~140 observed

/** Anchor open-tag of a job card; attributes parsed individually (order-proof). */
const CARD_ANCHOR_RE = /<a class="ca-single-job-card[^"]*"([^>]*)>/g;

function attr(attrs: string, key: string): string | null {
  const m = attrs.match(new RegExp(`${key}="([^"]*)"`));
  return m ? decodeEntities(m[1]).trim() : null;
}

interface Card {
  venue: string | null;
  jobId: string;
  title: string;
  href: string;
  windowHtml: string; // card block after the anchor, for sibling-div extraction
}

function parseCards(html: string): Card[] {
  CARD_ANCHOR_RE.lastIndex = 0;
  const anchors: { attrs: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = CARD_ANCHOR_RE.exec(html)) !== null) {
    anchors.push({ attrs: m[1], start: m.index, end: m.index + m[0].length });
  }
  const cards: Card[] = [];
  for (let i = 0; i < anchors.length; i++) {
    const { attrs, end } = anchors[i];
    const jobId = attr(attrs, "data-jobid");
    const title = attr(attrs, "data-title");
    const href = attr(attrs, "href");
    if (!jobId || !title || !href) continue;
    // Slice up to the next card anchor so sibling divs never bleed across cards.
    const windowEnd = i + 1 < anchors.length ? anchors[i + 1].start : end + 2200;
    const windowHtml = html.slice(end, windowEnd);
    cards.push({ venue: attr(attrs, "data-entity"), jobId, title, href, windowHtml });
  }
  return cards;
}

/** "Posted today" / "Posted 3 days ago" → ISO date. */
function parsePostedAt(windowHtml: string): string | null {
  const m = windowHtml.match(/Posted\s+(today|yesterday|(\d+)\s+days?\s+ago)/i);
  if (!m) return null;
  const daysAgo = m[1].toLowerCase() === "today" ? 0 : m[1].toLowerCase() === "yesterday" ? 1 : parseInt(m[2], 10);
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return d.toISOString().slice(0, 10);
}

function cardToPosting(card: Card): JobPosting {
  // Pay + employment type: `<span class="job-employment">Part Time · Hourly ($25.00 - $35.00)</span>`
  const employmentRaw = card.windowHtml.match(/job-employment">([^<]+)</);
  let pay: string | null = null;
  let schedule: string | null = null;
  if (employmentRaw) {
    const line = collapseWhitespace(decodeEntities(employmentRaw[1]));
    const payMatch = line.match(/\(([^)]+)\)/);
    if (payMatch) pay = /hour/i.test(line) ? `${payMatch[1]} / hr` : payMatch[1];
    const type = line.split("·")[0]?.trim();
    if (type && !type.startsWith("(")) schedule = type;
  }

  // Sibling text-muted divs: first = hospitality group, the one with ", NY" = address · cuisine.
  const muted = [...card.windowHtml.matchAll(/<div class="text-muted[^"]*">([^<]*)<\/div>/g)]
    .map((x) => collapseWhitespace(decodeEntities(x[1])))
    .filter(Boolean);
  let address: string | null = null;
  let group: string | null = null;
  let cuisine: string | null = null;
  for (const line of muted) {
    if (/,\s*(NY|New York)\b/i.test(line)) {
      const [addrPart, cuisinePart] = line.split("·").map((p) => p.trim());
      address = addrPart || null;
      cuisine = cuisinePart || null;
    } else if (!group) {
      group = line;
    }
  }

  const postedAt = parsePostedAt(card.windowHtml);
  const url = card.href.startsWith("http") ? card.href : `https://culinaryagents.com${card.href}`;
  const tags: string[] = [];
  if (group) tags.push(group);
  if (cuisine) tags.push(cuisine);

  const summaryBits = [
    card.venue ? `${card.title} at ${card.venue}` : card.title,
    address,
    pay,
  ].filter(Boolean);

  return {
    id: `ca-${card.jobId}`,
    source: name,
    url,
    title: card.title,
    venueName: card.venue || null,
    address,
    neighborhood: neighborhoodFromText(address),
    borough: inferBorough(address),
    pay,
    schedule,
    postedAt,
    summary: summaryBits.join(" — "),
    tags,
  };
}

export async function fetchJobs(): Promise<JobPosting[]> {
  const seen = new Set<string>();
  const jobs: JobPosting[] = [];

  for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_SIZE) {
    const url = offset === 0 ? BASE : `${BASE}&offset=${offset}`;
    const html = await fetchText(url);
    const cards = parseCards(html);
    let fresh = 0;
    for (const card of cards) {
      if (seen.has(card.jobId)) continue;
      seen.add(card.jobId);
      fresh++;
      jobs.push(cardToPosting(card));
    }
    // A page with no cards (or only repeats) ends the walk.
    if (cards.length === 0 || fresh === 0) break;
  }

  if (jobs.length === 0) throw new Error("culinary-agents: 0 cards parsed — markup changed or blocked");
  return jobs;
}
