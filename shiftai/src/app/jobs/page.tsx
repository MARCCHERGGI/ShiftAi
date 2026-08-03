"use client";

/**
 * Jobs — fresh Manhattan bartender openings aggregated from Culinary
 * Agents, hospitality-group boards, and Craigslist (scam-filtered) via
 * GET /api/jobs. Grouped by borough, Manhattan first. Each posting gets
 * "Prep this job" → /?url=<posting url> which auto-runs the agent crew.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Clock,
  Loader2,
  MapPin,
  Martini,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { JobPosting, JobsResponse } from "@/src/lib/jobs/types";
import { trackEvent } from "@/src/lib/track";

import NavBar from "@/src/components/ios/NavBar";
import Card from "@/src/components/ios/Card";
import PillButton from "@/src/components/ios/PillButton";

const GRAY = "var(--ios-gray, #8E8E93)";

/* Source slugs → human labels (both Craigslist lanes merge into one chip). */
const SOURCE_LABELS: Record<string, string> = {
  "culinary-agents": "Culinary Agents",
  greenhouse: "Hospitality groups",
  craigslist: "Craigslist",
  "craigslist-sapi": "Craigslist",
};

function sourceLabel(slug: string): string {
  return (
    SOURCE_LABELS[slug] ??
    slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export default function JobsPage() {
  const router = useRouter();

  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/jobs", { cache: "no-store" });
      const j = (await res.json()) as JobsResponse;
      if (!j.ok) throw new Error("Job boards didn't answer — try again in a minute.");
      setData(j);
      trackEvent("jobs_loaded", {
        total: j.jobs.length,
        sources: j.sources.filter((s) => s.ok).length,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Job boards didn't answer — try again in a minute.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const jobs = useMemo(() => data?.jobs ?? [], [data]);

  // Group by borough, Manhattan first, then by posting count.
  const boroughs = useMemo(() => {
    const groups = new Map<string, JobPosting[]>();
    for (const job of jobs) {
      const key = job.borough || "New York";
      const bucket = groups.get(key);
      if (bucket) bucket.push(job);
      else groups.set(key, [job]);
    }
    return [...groups.entries()].sort(([a, aJobs], [b, bJobs]) => {
      if (a === "Manhattan") return -1;
      if (b === "Manhattan") return 1;
      return bJobs.length - aJobs.length;
    });
  }, [jobs]);

  const prepJob = useCallback(
    (job: JobPosting) => {
      trackEvent("listing_prep", { job_id: job.id, source: job.source });
      router.push("/?url=" + encodeURIComponent(job.url));
    },
    [router],
  );

  return (
    <main>
      <NavBar
        title="Jobs"
        large
        right={
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh openings"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              border: "none",
              background: "transparent",
              color: "#007AFF",
              cursor: "pointer",
            }}
          >
            <RefreshCw
              size={19}
              strokeWidth={2}
              style={loading ? { animation: "ios-spin 1s linear infinite" } : undefined}
            />
          </button>
        }
      />

      <section style={{ padding: "0 16px" }}>
        <p style={{ fontSize: 15, lineHeight: 1.4, color: GRAY, margin: "4px 4px 10px" }}>
          Fresh Manhattan bartender openings from Culinary Agents, hospitality-group
          boards, and Craigslist, scam-filtered.
        </p>
        <SourceChips data={data} loading={loading} err={err} />
      </section>

      <section style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading && !data ? <FirstLoad /> : null}

        {err ? (
          <Card>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px", color: "#FF3B30" }}>
              Couldn&rsquo;t fetch openings
            </h3>
            <p style={{ fontSize: 15, margin: "0 0 12px", color: GRAY }}>{err}</p>
            <PillButton onPress={() => void load()} variant="tinted">
              Try again
            </PillButton>
          </Card>
        ) : null}

        {!loading && !err && jobs.length === 0 ? (
          <div className="empty">
            <Martini size={56} strokeWidth={1.5} className="empty__icon" />
            <h3 className="empty__title">No verified openings right now</h3>
            <p className="empty__desc">
              The boards re-scan hourly. Every listing that passes the scam filter
              shows up here.
            </p>
            <div className="empty__action">
              <PillButton onPress={() => void load()} variant="tinted">
                Refresh now
              </PillButton>
            </div>
          </div>
        ) : null}
      </section>

      {boroughs.map(([borough, boroughJobs], i) => (
        <section
          key={borough}
          style={{ padding: i === 0 ? "21px 16px 0" : "35px 16px 0" }}
        >
          <h2
            style={{
              fontSize: 13,
              fontWeight: 400,
              letterSpacing: "-0.08px",
              textTransform: "uppercase",
              color: GRAY,
              margin: 0,
              padding: "0 16px 7px",
            }}
          >
            {borough} · {boroughJobs.length}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {boroughJobs.map((job) => (
              <JobCard key={job.id} job={job} onPrep={() => prepJob(job)} />
            ))}
          </div>
        </section>
      ))}

      {jobs.length > 0 || (!loading && !err) ? (
        <footer
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 6,
            padding: "20px 24px 8px",
            fontSize: 12,
            lineHeight: 1.45,
            color: GRAY,
          }}
        >
          <ShieldCheck size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Sources: Culinary Agents, hospitality-group career boards, Craigslist
            Manhattan food/bev. AI scam filter blocks: fee asks, ID/bank requests,
            off-platform redirects, unrealistic pay.
          </span>
        </footer>
      ) : null}
    </main>
  );
}

/* ── source chips + refreshed time ───────────────── */

function relTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function SourceChips({
  data,
  loading,
  err,
}: {
  data: JobsResponse | null;
  loading: boolean;
  err: string | null;
}) {
  if (err) return null;

  const wrap: CSSProperties = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    fontSize: 13,
    color: GRAY,
    margin: "0 4px",
  };

  if (!data) {
    return (
      <p style={wrap}>
        <Loader2 size={12} strokeWidth={2.2} style={{ animation: "ios-spin 1s linear infinite" }} />
        <span>{loading ? "Scanning the boards…" : ""}</span>
      </p>
    );
  }

  const refreshed = relTime(data.fetchedAt);

  // Merge sources that share a display label (the two Craigslist lanes).
  const chips = new Map<string, { count: number; ok: boolean }>();
  for (const s of data.sources) {
    const label = sourceLabel(s.name);
    const prev = chips.get(label);
    chips.set(label, {
      count: (prev?.count ?? 0) + s.count,
      ok: (prev?.ok ?? false) || s.ok,
    });
  }

  return (
    <div style={wrap}>
      {[...chips.entries()].map(([label, s]) => (
        <span
          key={label}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 9px",
            borderRadius: 999,
            background: s.ok ? "rgba(0,122,255,0.12)" : "var(--bg-fill)",
            color: s.ok ? "#007AFF" : GRAY,
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {label} · {s.ok ? s.count : "—"}
        </span>
      ))}
      {refreshed ? (
        <span style={{ whiteSpace: "nowrap" }}>refreshed {refreshed}</span>
      ) : null}
    </div>
  );
}

/* ── posting card ────────────────────────────────── */

function JobCard({ job, onPrep }: { job: JobPosting; onPrep: () => void }) {
  const heading = job.venueName || job.title;
  const showTitle = !!job.venueName && job.title !== job.venueName;
  const posted = relTime(job.postedAt);

  const sub: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: GRAY,
    margin: "0 0 4px",
  };

  return (
    <Card>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 2,
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
          {heading}
        </h3>
        {job.pay ? (
          <span style={{ fontSize: 14, fontWeight: 600, color: "#248A3D", whiteSpace: "nowrap" }}>
            {job.pay}
          </span>
        ) : null}
      </header>

      {showTitle ? (
        <p style={{ fontSize: 15, fontWeight: 500, margin: "0 0 4px", color: "var(--label-2)" }}>
          {job.title}
        </p>
      ) : null}

      {job.neighborhood || job.address ? (
        <p style={sub}>
          <MapPin size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{[job.neighborhood, job.address].filter(Boolean).join(" · ")}</span>
        </p>
      ) : null}

      {job.schedule ? (
        <p style={{ ...sub, color: "#007AFF", fontWeight: 600 }}>
          <Clock size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>{job.schedule}</span>
        </p>
      ) : null}

      {job.summary ? (
        <p style={{ fontSize: 15, lineHeight: 1.45, margin: "8px 0" }}>{job.summary}</p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, margin: "2px 0 8px" }}>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            padding: "3px 9px",
            borderRadius: 999,
            background: "var(--bg-fill)",
            color: "var(--label-2)",
            fontSize: 12,
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {sourceLabel(job.source)}
        </span>
        {posted ? <span style={{ fontSize: 12, color: GRAY }}>{posted}</span> : null}
        {job.tags.slice(0, 3).map((tag) => (
          <span
            key={tag}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "3px 9px",
              borderRadius: 999,
              background: "rgba(0,122,255,0.12)",
              color: "#007AFF",
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <PillButton onPress={onPrep} variant="filled">
          <Sparkles size={15} strokeWidth={2.2} />
          Prep this job
        </PillButton>
        <a
          href={job.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("listing_click", { job_id: job.id, source: job.source })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 14,
            fontWeight: 600,
            color: "#007AFF",
            textDecoration: "none",
            padding: "8px 4px",
          }}
        >
          View listing
          <ArrowUpRight size={14} strokeWidth={2.4} />
        </a>
      </div>
    </Card>
  );
}

/* ── first load (cold scan can take a while) ─────── */

function FirstLoad() {
  const row: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    padding: "6px 0",
  };
  return (
    <Card>
      <div style={{ ...row, fontWeight: 600 }}>
        <Loader2
          size={16}
          strokeWidth={2.4}
          color="#007AFF"
          style={{ animation: "ios-spin 1s linear infinite" }}
        />
        <span>Scanning Culinary Agents, group boards, and Craigslist</span>
      </div>
      <div style={{ ...row, color: GRAY }}>
        <span style={{ width: 16 }} />
        <span>Filtering scams</span>
      </div>
      <div style={{ ...row, color: GRAY }}>
        <span style={{ width: 16 }} />
        <span>Extracting venues, pay, and schedules</span>
      </div>
      <p style={{ fontSize: 13, margin: "8px 0 0", color: GRAY }}>
        First load takes ~30s. Cached after that.
      </p>
    </Card>
  );
}
