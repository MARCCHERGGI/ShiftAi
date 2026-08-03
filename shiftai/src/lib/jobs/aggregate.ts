/**
 * Multi-source Manhattan bartender jobs aggregator.
 *
 * Parallel-fetches every source (Promise.allSettled — one dead source never
 * kills the feed), filters to bar roles, dedupes (id → url → venue+title,
 * field-merging so the richest record wins), ranks Manhattan-first then
 * freshest-first, and caches in-memory for 30 minutes.
 */

import type { JobPosting, JobSourceStatus } from "./types";
import * as culinaryAgents from "./sources/culinaryAgents";
import * as greenhouse from "./sources/greenhouse";
import * as craigslist from "./sources/craigslist";
import * as craigslistSapi from "./sources/craigslistSapi";

export interface AggregateResult {
  fetchedAt: string;
  sources: JobSourceStatus[];
  jobs: JobPosting[];
}

interface Source {
  name: string;
  fetchJobs: () => Promise<JobPosting[]>;
}

const SOURCES: Source[] = [culinaryAgents, greenhouse, craigslist, craigslistSapi];

/** Ranking priority when freshness ties (primary board first). */
const SOURCE_RANK: Record<string, number> = {
  [culinaryAgents.name]: 0,
  [greenhouse.name]: 1,
  [craigslist.name]: 2,
  [craigslistSapi.name]: 3,
};

/* ── role filter ─────────────────────────────────── */

// Role phrases only — a bare \bbar\b matches venue names ("Bar Chimera") and
// pulled Line Cooks / Lunch Runners into the feed during live testing.
const BAR_ROLE_RE =
  /bar\s?tend|bar\s?back|mixolog|cocktail|drink\s*runner|bar\s+(captain|manager|director|lead|staff|team|porter|crew)\b/i;
// "sushi bar server" / "juice bar attendant" / baristas are not bar roles.
const BAR_EXCLUDE_RE = /sushi\s*bar|juice\s*bar|coffee\s*bar|raw\s*bar|barista|barre\b/i;

export function isBarRole(job: JobPosting): boolean {
  return BAR_ROLE_RE.test(job.title) && !BAR_EXCLUDE_RE.test(job.title);
}

/* ── dedupe ──────────────────────────────────────── */

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function canonicalUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname.replace(/\/+$/, "")}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** Non-null informative fields — higher = richer record. */
function richness(job: JobPosting): number {
  let score = 0;
  for (const v of [job.venueName, job.address, job.neighborhood, job.pay, job.schedule, job.postedAt]) {
    if (v) score += 10;
  }
  if (job.summary && job.summary !== job.title) score += 1;
  return score;
}

/** Keep the richer of two duplicate records; backfill its nulls from the other. */
function merge(a: JobPosting, b: JobPosting): JobPosting {
  const [keep, other] = richness(b) > richness(a) ? [b, a] : [a, b];
  return {
    ...keep,
    venueName: keep.venueName ?? other.venueName,
    address: keep.address ?? other.address,
    neighborhood: keep.neighborhood ?? other.neighborhood,
    pay: keep.pay ?? other.pay,
    schedule: keep.schedule ?? other.schedule,
    postedAt: keep.postedAt ?? other.postedAt,
    borough: keep.borough !== "New York" ? keep.borough : other.borough,
    tags: [...new Set([...keep.tags, ...other.tags])],
  };
}

export function dedupe(jobs: JobPosting[]): JobPosting[] {
  const kept: JobPosting[] = [];
  const keyToIndex = new Map<string, number>();

  for (const job of jobs) {
    const keys = [`id:${job.id}`, `url:${canonicalUrl(job.url)}`];
    if (job.venueName) keys.push(`vt:${norm(job.venueName)}|${norm(job.title)}`);

    const hitIndex = keys.map((k) => keyToIndex.get(k)).find((i) => i !== undefined);
    if (hitIndex !== undefined) {
      kept[hitIndex] = merge(kept[hitIndex], job);
      for (const k of keys) keyToIndex.set(k, hitIndex);
    } else {
      const index = kept.push(job) - 1;
      for (const k of keys) keyToIndex.set(k, index);
    }
  }
  return kept;
}

/* ── ranking ─────────────────────────────────────── */

function compare(a: JobPosting, b: JobPosting): number {
  const aM = a.borough === "Manhattan" ? 0 : 1;
  const bM = b.borough === "Manhattan" ? 0 : 1;
  if (aM !== bM) return aM - bM;
  // Fresh first; unknown dates sink below any dated posting.
  if (a.postedAt !== b.postedAt) {
    if (!a.postedAt) return 1;
    if (!b.postedAt) return -1;
    return a.postedAt < b.postedAt ? 1 : -1;
  }
  const rank = (SOURCE_RANK[a.source] ?? 9) - (SOURCE_RANK[b.source] ?? 9);
  if (rank !== 0) return rank;
  return a.title.localeCompare(b.title);
}

/* ── cache + entry point ─────────────────────────── */

const TTL_MS = 30 * 60 * 1000;

let cache: AggregateResult | null = null;
let cachedAtMs = 0;
let inFlight: Promise<AggregateResult> | null = null;

async function refresh(): Promise<AggregateResult> {
  const settled = await Promise.allSettled(SOURCES.map((s) => s.fetchJobs()));

  const sources: JobSourceStatus[] = settled.map((s, i) => ({
    name: SOURCES[i].name,
    count: s.status === "fulfilled" ? s.value.length : 0,
    ok: s.status === "fulfilled",
  }));
  for (const [i, s] of settled.entries()) {
    if (s.status === "rejected") {
      console.warn(`[jobs] source ${SOURCES[i].name} failed:`, s.reason?.message ?? s.reason);
    }
  }

  const raw = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
  const jobs = dedupe(raw.filter(isBarRole)).sort(compare);

  // Stale-if-error: a pass where EVERY source died shouldn't wipe a good feed.
  if (jobs.length === 0 && sources.every((s) => !s.ok) && cache && cache.jobs.length > 0) {
    return { ...cache, sources };
  }

  const result: AggregateResult = { fetchedAt: new Date().toISOString(), sources, jobs };
  cache = result;
  cachedAtMs = Date.now();
  return result;
}

export async function getJobs(opts?: { force?: boolean }): Promise<AggregateResult> {
  if (!opts?.force && cache && Date.now() - cachedAtMs < TTL_MS) return cache;
  if (inFlight) return inFlight;
  inFlight = refresh().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

export function getJobsCacheMeta(): { hasCache: boolean; ageMs: number | null } {
  return { hasCache: cache !== null, ageMs: cache ? Date.now() - cachedAtMs : null };
}
