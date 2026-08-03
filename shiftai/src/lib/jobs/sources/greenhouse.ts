/**
 * Greenhouse boards-api sweep — the 4 NYC hospitality slugs that actually exist
 * (research probed ~50 more + all Lever/Ashby hospitality slugs: 404 across the
 * board — NYC restaurant groups hire via Culinary Agents, not ATSes).
 *
 * Public CloudFront JSON, no auth, datacenter-safe. Quirks (live-tested):
 *   - slug "550": location.name is literally "550" — do NOT NY-filter; the whole
 *     venue is 550 Madison Ave, Midtown Manhattan.
 *   - slug "sohohouseco": 371-job GLOBAL board — must filter location for NY.
 */

import type { JobPosting } from "../types";
import { collapseWhitespace, decodeEntities, neighborhoodFromText } from "../http";

export const name = "greenhouse";

const TIMEOUT_MS = 10_000;
// Role phrases only — a bare \bbar\b would match venue names like "Bar Chimera"
// and drag in Line Cooks and Lunch Runners (it did, in live testing).
const BAR_TITLE_RE =
  /bar\s?tend|bar\s?back|mixolog|cocktail|drink\s*runner|bar\s+(captain|manager|director|lead|staff|team|porter|crew)\b/i;

interface GhJob {
  id: number;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
}

interface Board {
  slug: string;
  venueName: string;
  /** null = take every job on the board (single-venue boards). */
  locationFilter: RegExp | null;
  defaultAddress: string | null;
  defaultNeighborhood: string | null;
}

const BOARDS: Board[] = [
  {
    slug: "550",
    venueName: "550 Madison (COTE group)",
    locationFilter: null, // location.name is "550", not a city — whole board is Midtown
    defaultAddress: "550 Madison Ave, New York, NY 10022",
    defaultNeighborhood: "Midtown East",
  },
  {
    slug: "cotenyc",
    venueName: "COTE Korean Steakhouse",
    locationFilter: null, // single NYC venue ("New York, New York, United States")
    defaultAddress: "16 W 22nd St, New York, NY 10010",
    defaultNeighborhood: "Flatiron",
  },
  {
    slug: "mossnewyorkllc",
    venueName: "Moss",
    locationFilter: null, // single NYC club, location carries "New York, NY 10036"
    defaultAddress: null,
    defaultNeighborhood: null,
  },
  {
    slug: "sohohouseco",
    venueName: "Soho House & Co",
    locationFilter: /new york|brooklyn|dumbo/i, // global board — NY venues only
    defaultAddress: null,
    defaultNeighborhood: null,
  },
];

async function fetchBoard(board: Board): Promise<JobPosting[]> {
  const res = await fetch(`https://boards-api.greenhouse.io/v1/boards/${board.slug}/jobs`, {
    headers: { accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`greenhouse/${board.slug}: ${res.status}`);
  const data = (await res.json()) as { jobs?: GhJob[] };
  if (!Array.isArray(data.jobs)) throw new Error(`greenhouse/${board.slug}: no jobs[]`);

  const out: JobPosting[] = [];
  for (const job of data.jobs) {
    if (!job?.title || !job.absolute_url) continue;
    const loc = collapseWhitespace(decodeEntities(job.location?.name ?? ""));
    if (board.locationFilter && !board.locationFilter.test(loc)) continue;
    if (!BAR_TITLE_RE.test(job.title)) continue;

    // Soho House location.name is a full street address ("Soho House New York,
    // 29-35 9th Ave, New York, NY 10014") — venue is the part before the first
    // comma, EXCEPT when the title names the house ("Seasonal Bartender - Dumbo
    // House" posted from "New York Support Office"): prefer the title's house.
    const locIsAddress = /\d/.test(loc) && /,/.test(loc);
    const titleHouse = job.title.match(/-\s*([^-]*house[^-]*)$/i)?.[1]?.trim();
    const venueName =
      board.slug === "sohohouseco"
        ? titleHouse || (loc ? loc.split(",")[0].trim() : board.venueName)
        : board.venueName;
    const address = locIsAddress ? loc : board.defaultAddress;
    const borough = /brooklyn|dumbo/i.test(loc) ? "Brooklyn" : "Manhattan";

    out.push({
      id: `gh-${board.slug}-${job.id}`,
      source: name,
      url: job.absolute_url,
      title: collapseWhitespace(decodeEntities(job.title)),
      venueName,
      address,
      neighborhood: neighborhoodFromText(address) ?? board.defaultNeighborhood,
      borough,
      pay: null, // list API has no comp; detail ?content=true exists but stays on-demand
      schedule: null,
      postedAt: job.updated_at ? new Date(job.updated_at).toISOString() : null,
      summary: [`${collapseWhitespace(decodeEntities(job.title))} at ${venueName}`, address]
        .filter(Boolean)
        .join(" — "),
      tags: ["ats", board.slug],
    });
  }
  return out;
}

export async function fetchJobs(): Promise<JobPosting[]> {
  const settled = await Promise.allSettled(BOARDS.map(fetchBoard));
  const jobs = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const failures = settled.filter((s) => s.status === "rejected");
  // One dead board shouldn't kill the sweep; all four dead means the source is down.
  if (failures.length === BOARDS.length) {
    throw new Error(`greenhouse: all boards failed — ${(failures[0] as PromiseRejectedResult).reason}`);
  }
  return jobs;
}
