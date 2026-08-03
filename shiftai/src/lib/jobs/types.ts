/**
 * Shared contracts for the multi-source Manhattan bartender jobs engine.
 * Every source adapter, the aggregator, and /api/jobs code against THESE shapes.
 */

export interface JobPosting {
  /** Stable, source-prefixed id, e.g. "ca-713145-821273", "gh-550-4012345", "cl-cyQx2DL2". */
  id: string;
  /** Source slug: "culinary-agents" | "greenhouse" | "craigslist" | "craigslist-sapi". */
  source: string;
  /** Absolute URL of the posting. */
  url: string;
  title: string;
  venueName: string | null;
  address: string | null;
  neighborhood: string | null;
  /** "Manhattan" | "Brooklyn" | "Queens" | "Bronx" | "Staten Island" | "New York" (NYC, borough unknown). */
  borough: string;
  /** Raw pay string as the source presents it, e.g. "$25.00 - $35.00 / hr". */
  pay: string | null;
  /** e.g. "Part Time", "Full Time", shift notes. */
  schedule: string | null;
  /** ISO date/datetime when known, null when the source hides it. */
  postedAt: string | null;
  /** One-line human summary for the card. */
  summary: string;
  tags: string[];
}

export interface JobSourceStatus {
  name: string;
  /** Jobs this source yielded on the last fetch (post source-scope filter, pre-dedupe). */
  count: number;
  ok: boolean;
}

/** Response shape of GET /api/jobs. */
export interface JobsResponse {
  ok: boolean;
  fetchedAt: string; // ISO
  sources: JobSourceStatus[];
  jobs: JobPosting[];
}
