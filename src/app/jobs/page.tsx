"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  DollarSign,
  Clock,
  Briefcase,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
} from "lucide-react";
import {
  saveResearch,
  getResearch,
  clearResearch,
} from "@/src/lib/research-store";
import { trackEvent } from "@/src/lib/track";
import type { ResearchPackage } from "@/src/lib/types";

const steps = [
  "Analyzing listing",
  "Researching venue",
  "Scanning neighborhood",
  "Preparing questions",
];

export default function JobsPage() {
  const router = useRouter();
  const [listing, setListing] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [research, setResearch] = useState<ResearchPackage | null>(null);
  const [expanded, setExpanded] = useState<string | null>("job");
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = getResearch();
    if (existing) setResearch(existing);
  }, []);

  const handleAnalyze = async () => {
    if (!listing.trim()) return;
    setLoading(true);
    setError("");
    setStep(0);
    const startedAt = Date.now();
    trackEvent("job_analyze_start", {
      listing_length: listing.length,
      words: listing.trim().split(/\s+/).length,
    });
    const iv = setInterval(() => setStep((p) => Math.min(p + 1, 3)), 2800);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }
      const data: ResearchPackage = await res.json();
      setResearch(data);
      saveResearch(data);
      trackEvent("job_analyze_success", {
        elapsed_ms: Date.now() - startedAt,
        restaurant: data.job?.restaurant ?? "unknown",
        job_title: data.job?.title ?? "unknown",
        questions: data.questions?.length ?? 0,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      trackEvent("job_analyze_error", {
        elapsed_ms: Date.now() - startedAt,
        message: err instanceof Error ? err.message.slice(0, 100) : "unknown",
      });
    } finally {
      clearInterval(iv);
      setLoading(false);
    }
  };

  // ── Loading ──────────────────────────────────────
  if (loading) {
    return (
      <div className="fade-in px-5 max-w-lg mx-auto pt-12">
        <p className="label mb-6">Agents working</p>
        <div className="space-y-4">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {i < step ? (
                <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: "var(--success)" }} />
              ) : i === step ? (
                <div className="spinner flex-shrink-0" />
              ) : (
                <div className="w-[18px] h-[18px] rounded-full flex-shrink-0" style={{ border: "2px solid var(--border)" }} />
              )}
              <span
                className="text-sm"
                style={{ color: i <= step ? "var(--text)" : "var(--text-tertiary)" }}
              >
                {s}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Results ──────────────────────────────────────
  if (research) {
    const { job, venue, location: loc } = research;
    const toggle = (s: string) => setExpanded(expanded === s ? null : s);

    return (
      <div className="fade-in px-5 max-w-lg mx-auto">
        <div className="pt-6 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="heading">{job.title}</h1>
              <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                {job.restaurant} &middot; {job.location}
              </p>
            </div>
            <button
              onClick={() => { setResearch(null); setListing(""); clearResearch(); }}
              className="text-xs px-2.5 py-1 rounded-md flex-shrink-0"
              style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
            >
              New
            </button>
          </div>
          <div className="flex gap-1.5 mt-3 flex-wrap">
            <span className="badge"><DollarSign className="w-3 h-3" />{job.pay}</span>
            <span className="badge"><Clock className="w-3 h-3" />{job.type}</span>
            <span className="badge"><Briefcase className="w-3 h-3" />{job.difficultyLevel}</span>
          </div>
        </div>

        {/* Sections */}
        <div className="mt-2">
          {/* Job Analysis */}
          <div style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => toggle("job")} className="w-full py-4 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Job Analysis</span>
              {expanded === "job" ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />}
            </button>
            {expanded === "job" && (
              <div className="pb-4 space-y-4 text-xs" style={{ color: "var(--text-secondary)" }}>
                <p className="text-sm" style={{ color: "var(--text)" }}>{job.description}</p>
                {job.greenFlags.length > 0 && (
                  <div>
                    <p className="label mb-2" style={{ color: "var(--success)" }}>Green flags</p>
                    {job.greenFlags.map((f, i) => <p key={i} className="py-0.5 pl-3">&bull; {f}</p>)}
                  </div>
                )}
                {job.redFlags.length > 0 && (
                  <div>
                    <p className="label mb-2" style={{ color: "var(--danger)" }}>Red flags</p>
                    {job.redFlags.map((f, i) => <p key={i} className="py-0.5 pl-3">&bull; {f}</p>)}
                  </div>
                )}
                <div className="p-3 rounded-lg" style={{ background: "var(--surface)" }}>
                  <p className="label mb-1">Pay verdict</p>
                  <p style={{ color: "var(--text)" }}>{job.payVerdict}</p>
                </div>
                {job.tips.length > 0 && (
                  <div>
                    <p className="label mb-2">Tips for applying</p>
                    {job.tips.map((t, i) => <p key={i} className="py-0.5 pl-3">&bull; {t}</p>)}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Venue */}
          <div style={{ borderTop: "1px solid var(--border)" }}>
            <button onClick={() => toggle("venue")} className="w-full py-4 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Venue Profile</span>
              {expanded === "venue" ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />}
            </button>
            {expanded === "venue" && (
              <div className="pb-4 space-y-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Type", venue.type],
                    ["Price", venue.priceRange],
                    ["Dress Code", venue.dressCode],
                    ["Avg Tips", venue.tipsAverage],
                  ].map(([l, v], i) => (
                    <div key={i} className="p-2.5 rounded-lg" style={{ background: "var(--surface)" }}>
                      <p className="label mb-0.5">{l}</p>
                      <p style={{ color: "var(--text)" }}>{v}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="label mb-1">Atmosphere</p>
                  <p>{venue.atmosphere}</p>
                </div>
                <div>
                  <p className="label mb-1">Clientele</p>
                  <p>{venue.clientele}</p>
                </div>
                {venue.popularDrinks.length > 0 && (
                  <div>
                    <p className="label mb-1.5">Popular drinks</p>
                    <div className="flex flex-wrap gap-1">
                      {venue.popularDrinks.map((d, i) => (
                        <span key={i} className="badge" style={{ background: "var(--accent-dim)", color: "var(--accent-text)" }}>{d}</span>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <p className="label mb-1">Known for</p>
                  <p>{venue.knownFor}</p>
                </div>
              </div>
            )}
          </div>

          {/* Location */}
          <div style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <button onClick={() => toggle("loc")} className="w-full py-4 flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: "var(--text)" }}>Location Intel</span>
              {expanded === "loc" ? <ChevronUp className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--text-tertiary)" }} />}
            </button>
            {expanded === "loc" && (
              <div className="pb-4 space-y-3 text-xs" style={{ color: "var(--text-secondary)" }}>
                <p className="text-sm font-medium" style={{ color: "var(--text)" }}>{loc.neighborhood}</p>
                <p>{loc.vibe}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ["Transit", loc.transitAccess],
                    ["Foot Traffic", loc.footTraffic],
                    ["Avg Pay", loc.avgBarPay],
                    ["Nightlife", loc.nightlifeRating],
                  ].map(([l, v], i) => (
                    <div key={i} className="p-2.5 rounded-lg" style={{ background: "var(--surface)" }}>
                      <p className="label mb-0.5">{l}</p>
                      <p style={{ color: "var(--text)" }}>{v}</p>
                    </div>
                  ))}
                </div>
                {loc.prosForWorkers.length > 0 && (
                  <div>
                    <p className="label mb-1" style={{ color: "var(--success)" }}>Pros</p>
                    {loc.prosForWorkers.map((p, i) => <p key={i} className="py-0.5 pl-3">+ {p}</p>)}
                  </div>
                )}
                {loc.consForWorkers.length > 0 && (
                  <div>
                    <p className="label mb-1" style={{ color: "var(--accent)" }}>Cons</p>
                    {loc.consForWorkers.map((c, i) => <p key={i} className="py-0.5 pl-3">- {c}</p>)}
                  </div>
                )}
                <div className="p-3 rounded-lg" style={{ background: "var(--surface)" }}>
                  <p className="label mb-1">Safety</p>
                  <p style={{ color: "var(--text)" }}>{loc.safetyNote}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-2.5 pb-6">
          <button
            onClick={() => {
              trackEvent("nav_click", { target: "/interview", from: "jobs_results" });
              router.push("/interview");
            }}
            className="btn-primary"
          >
            <MessageSquare className="w-4 h-4" />
            Prep Interview ({research.questions.length} Qs)
          </button>
          <button
            onClick={() => {
              trackEvent("nav_click", { target: "/resume-builder", from: "jobs_results" });
              router.push("/resume-builder");
            }}
            className="btn-ghost"
          >
            <FileText className="w-4 h-4" />
            Build Resume
          </button>
        </div>
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────
  return (
    <div className="fade-in px-5 max-w-lg mx-auto">
      <div className="pt-8 pb-6">
        <h1 className="display">
          Analyze a<br />listing.
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Paste any bartender job listing. AI agents will research the
          restaurant, location, pay, and prepare your interview.
        </p>
      </div>

      <textarea
        value={listing}
        onChange={(e) => setListing(e.target.value)}
        placeholder={"Paste a job listing here...\n\nExample: Bartender wanted at The Blue Bar, Williamsburg Brooklyn. $20-25/hr + tips. 2+ years experience required."}
        className="input-field resize-none"
        rows={8}
      />

      <div className="mt-4 flex flex-wrap gap-1.5">
        {["Job details", "Venue profile", "Location", "Reviews", "Interview Qs", "Resume tips"].map(
          (label) => (
            <span key={label} className="badge">{label}</span>
          )
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 rounded-lg text-sm" style={{ background: "var(--danger-dim)", color: "var(--danger)" }}>
          {error}
        </div>
      )}

      <div className="mt-6 pb-6">
        <button onClick={handleAnalyze} disabled={!listing.trim()} className="btn-primary">
          <Search className="w-4 h-4" />
          Run Analysis
        </button>
      </div>
    </div>
  );
}
