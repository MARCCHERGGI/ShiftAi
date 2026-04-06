"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  DollarSign,
  Clock,
  AlertTriangle,
  CheckCircle,
  Building2,
  Navigation,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Briefcase,
} from "lucide-react";
import {
  saveResearch,
  getResearch,
  clearResearch,
} from "@/src/lib/research-store";
import type { ResearchPackage } from "@/src/lib/types";

const agentSteps = [
  { name: "Job Scout", action: "Analyzing listing...", icon: "🔍" },
  { name: "Venue Researcher", action: "Profiling restaurant...", icon: "🏪" },
  { name: "Location Intel", action: "Scanning neighborhood...", icon: "📍" },
  { name: "Interview Coach", action: "Preparing questions...", icon: "🎯" },
];

export default function JobsPage() {
  const router = useRouter();
  const [listing, setListing] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentStep, setAgentStep] = useState(0);
  const [research, setResearch] = useState<ResearchPackage | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("job");
  const [error, setError] = useState("");

  useEffect(() => {
    const existing = getResearch();
    if (existing) setResearch(existing);
  }, []);

  const handleAnalyze = async () => {
    if (!listing.trim()) return;
    setLoading(true);
    setError("");
    setAgentStep(0);

    const stepInterval = setInterval(() => {
      setAgentStep((prev) => Math.min(prev + 1, agentSteps.length - 1));
    }, 2500);

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
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
    } finally {
      clearInterval(stepInterval);
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const startNewSearch = () => {
    setResearch(null);
    setListing("");
    clearResearch();
  };

  // ── Loading State ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="page-enter px-5 max-w-lg mx-auto">
        <div className="pt-10 pb-4 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <h1
            className="text-xl font-bold mb-2"
            style={{ color: "var(--foreground)" }}
          >
            Agents Working...
          </h1>
          <p className="text-sm" style={{ color: "var(--secondary)" }}>
            Running deep analysis on your listing
          </p>
        </div>

        <div className="mt-8 space-y-3">
          {agentSteps.map((step, i) => (
            <div
              key={i}
              className="rounded-2xl p-4 flex items-center gap-3 transition-all duration-500"
              style={{
                background:
                  i <= agentStep ? "var(--card-bg)" : "transparent",
                border: `1px solid ${i <= agentStep ? "var(--card-border)" : "transparent"}`,
                opacity: i <= agentStep ? 1 : 0.3,
              }}
            >
              <span className="text-2xl">{step.icon}</span>
              <div className="flex-1">
                <p
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {step.name}
                </p>
                <p className="text-xs" style={{ color: "var(--secondary)" }}>
                  {step.action}
                </p>
              </div>
              {i < agentStep && (
                <CheckCircle className="w-5 h-5 text-emerald-500" />
              )}
              {i === agentStep && (
                <div className="w-5 h-5 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" />
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Results State ───────────────────────────────────────────────
  if (research) {
    const { job, venue, location: loc } = research;
    return (
      <div className="page-enter px-5 max-w-lg mx-auto">
        {/* Header */}
        <div className="pt-4 pb-2">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="text-xl font-bold"
                style={{ color: "var(--foreground)" }}
              >
                {job.title}
              </h1>
              <p
                className="text-sm mt-0.5"
                style={{ color: "var(--secondary)" }}
              >
                {job.restaurant} &middot; {job.location}
              </p>
            </div>
            <button
              onClick={startNewSearch}
              className="text-xs px-3 py-1.5 rounded-lg"
              style={{
                background: "var(--input-bg)",
                color: "var(--secondary)",
              }}
            >
              New
            </button>
          </div>

          {/* Quick stats */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <span
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
              style={{
                background: "var(--input-bg)",
                color: "var(--foreground)",
              }}
            >
              <DollarSign className="w-3 h-3" /> {job.pay}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
              style={{
                background: "var(--input-bg)",
                color: "var(--foreground)",
              }}
            >
              <Clock className="w-3 h-3" /> {job.type}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
              style={{
                background: "var(--input-bg)",
                color: "var(--foreground)",
              }}
            >
              <Briefcase className="w-3 h-3" /> {job.difficultyLevel}
            </span>
          </div>
        </div>

        {/* Expandable Sections */}
        <div className="mt-4 space-y-3">
          {/* Job Analysis */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <button
              onClick={() => toggleSection("job")}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Search
                  className="w-4 h-4"
                  style={{ color: "var(--primary)" }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Job Analysis
                </span>
              </div>
              {expandedSection === "job" ? (
                <ChevronUp
                  className="w-4 h-4"
                  style={{ color: "var(--secondary)" }}
                />
              ) : (
                <ChevronDown
                  className="w-4 h-4"
                  style={{ color: "var(--secondary)" }}
                />
              )}
            </button>
            {expandedSection === "job" && (
              <div className="px-4 pb-4 space-y-3">
                <p
                  className="text-sm"
                  style={{ color: "var(--foreground)" }}
                >
                  {job.description}
                </p>

                {job.greenFlags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-500 mb-1.5 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Green Flags
                    </p>
                    {job.greenFlags.map((flag, i) => (
                      <p
                        key={i}
                        className="text-xs py-1 pl-4"
                        style={{ color: "var(--foreground)" }}
                      >
                        &bull; {flag}
                      </p>
                    ))}
                  </div>
                )}

                {job.redFlags.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-red-400 mb-1.5 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Red Flags
                    </p>
                    {job.redFlags.map((flag, i) => (
                      <p
                        key={i}
                        className="text-xs py-1 pl-4"
                        style={{ color: "var(--foreground)" }}
                      >
                        &bull; {flag}
                      </p>
                    ))}
                  </div>
                )}

                <div
                  className="rounded-xl p-3"
                  style={{ background: "var(--input-bg)" }}
                >
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "var(--primary)" }}
                  >
                    Pay Verdict
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    {job.payVerdict}
                  </p>
                </div>

                {job.tips.length > 0 && (
                  <div>
                    <p
                      className="text-xs font-medium mb-1.5"
                      style={{ color: "var(--primary)" }}
                    >
                      Application Tips
                    </p>
                    {job.tips.map((tip, i) => (
                      <p
                        key={i}
                        className="text-xs py-1 pl-4"
                        style={{ color: "var(--foreground)" }}
                      >
                        &bull; {tip}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Venue Profile */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <button
              onClick={() => toggleSection("venue")}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4" style={{ color: "#10b981" }} />
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Venue Profile
                </span>
              </div>
              {expandedSection === "venue" ? (
                <ChevronUp
                  className="w-4 h-4"
                  style={{ color: "var(--secondary)" }}
                />
              ) : (
                <ChevronDown
                  className="w-4 h-4"
                  style={{ color: "var(--secondary)" }}
                />
              )}
            </button>
            {expandedSection === "venue" && (
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Type", value: venue.type },
                    { label: "Price Range", value: venue.priceRange },
                    { label: "Dress Code", value: venue.dressCode },
                    { label: "Tips Avg", value: venue.tipsAverage },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-2.5"
                      style={{ background: "var(--input-bg)" }}
                    >
                      <p
                        className="text-[10px] uppercase tracking-wide"
                        style={{ color: "var(--secondary)" }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                <div>
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "#10b981" }}
                  >
                    Atmosphere
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    {venue.atmosphere}
                  </p>
                </div>

                <div>
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "#10b981" }}
                  >
                    Clientele
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    {venue.clientele}
                  </p>
                </div>

                {venue.popularDrinks.length > 0 && (
                  <div>
                    <p
                      className="text-xs font-medium mb-1"
                      style={{ color: "#10b981" }}
                    >
                      Popular Drinks
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {venue.popularDrinks.map((drink, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-1 rounded-full"
                          style={{
                            background: "rgba(16, 185, 129, 0.1)",
                            color: "#10b981",
                          }}
                        >
                          {drink}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "#10b981" }}
                  >
                    Known For
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    {venue.knownFor}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Location Intel */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: "var(--card-bg)",
              border: "1px solid var(--card-border)",
            }}
          >
            <button
              onClick={() => toggleSection("location")}
              className="w-full p-4 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Navigation
                  className="w-4 h-4"
                  style={{ color: "#f59e0b" }}
                />
                <span
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  Location Intel
                </span>
              </div>
              {expandedSection === "location" ? (
                <ChevronUp
                  className="w-4 h-4"
                  style={{ color: "var(--secondary)" }}
                />
              ) : (
                <ChevronDown
                  className="w-4 h-4"
                  style={{ color: "var(--secondary)" }}
                />
              )}
            </button>
            {expandedSection === "location" && (
              <div className="px-4 pb-4 space-y-3">
                <p
                  className="text-sm font-medium"
                  style={{ color: "var(--foreground)" }}
                >
                  {loc.neighborhood}
                </p>
                <p
                  className="text-xs"
                  style={{ color: "var(--secondary)" }}
                >
                  {loc.vibe}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Transit", value: loc.transitAccess },
                    { label: "Foot Traffic", value: loc.footTraffic },
                    { label: "Avg Pay", value: loc.avgBarPay },
                    { label: "Nightlife", value: loc.nightlifeRating },
                  ].map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl p-2.5"
                      style={{ background: "var(--input-bg)" }}
                    >
                      <p
                        className="text-[10px] uppercase tracking-wide"
                        style={{ color: "var(--secondary)" }}
                      >
                        {item.label}
                      </p>
                      <p
                        className="text-xs font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>

                {loc.prosForWorkers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-emerald-500 mb-1">
                      Pros
                    </p>
                    {loc.prosForWorkers.map((pro, i) => (
                      <p
                        key={i}
                        className="text-xs py-0.5 pl-3"
                        style={{ color: "var(--foreground)" }}
                      >
                        + {pro}
                      </p>
                    ))}
                  </div>
                )}

                {loc.consForWorkers.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-amber-500 mb-1">
                      Cons
                    </p>
                    {loc.consForWorkers.map((con, i) => (
                      <p
                        key={i}
                        className="text-xs py-0.5 pl-3"
                        style={{ color: "var(--foreground)" }}
                      >
                        - {con}
                      </p>
                    ))}
                  </div>
                )}

                <div
                  className="rounded-xl p-3"
                  style={{ background: "var(--input-bg)" }}
                >
                  <p
                    className="text-xs font-medium mb-1"
                    style={{ color: "#f59e0b" }}
                  >
                    Safety
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: "var(--foreground)" }}
                  >
                    {loc.safetyNote}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action CTAs */}
        <div className="mt-6 space-y-3 pb-4">
          <button
            onClick={() => router.push("/interview")}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #10b981, #059669)",
            }}
          >
            <MessageSquare className="w-5 h-5" />
            Prep Interview ({research.questions.length} Questions)
          </button>
          <button
            onClick={() => router.push("/resume-builder")}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            }}
          >
            <FileText className="w-5 h-5" />
            Build Tailored Resume
          </button>
        </div>
      </div>
    );
  }

  // ── Empty State — Paste Listing ─────────────────────────────────
  return (
    <div className="page-enter px-5 max-w-lg mx-auto">
      <div className="pt-6 pb-4">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Analyze a{" "}
          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            Job Listing
          </span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--secondary)" }}>
          Paste any bartender job listing and our AI agents will research
          everything about it
        </p>
      </div>

      <div className="mt-2">
        <textarea
          value={listing}
          onChange={(e) => setListing(e.target.value)}
          placeholder={
            "Paste a job listing here...\n\nExample:\nBartender wanted at The Blue Bar, Williamsburg Brooklyn. $20-25/hr + tips. Must have 2+ years experience, knowledge of craft cocktails, and TIPS certification. Weekend availability required."
          }
          className="input-field resize-none"
          rows={10}
          style={{ borderRadius: "16px", lineHeight: "1.6" }}
        />
      </div>

      {/* Agent preview */}
      <div
        className="mt-4 rounded-2xl p-4"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <p
          className="text-xs font-medium mb-3"
          style={{ color: "var(--primary)" }}
        >
          6 AI Agents will analyze:
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: "🔍", label: "Job details & flags" },
            { icon: "🏪", label: "Restaurant profile" },
            { icon: "📍", label: "Location & commute" },
            { icon: "⭐", label: "Reviews & reputation" },
            { icon: "🎯", label: "Interview questions" },
            { icon: "📄", label: "Resume optimization" },
          ].map((agent, i) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <span className="text-sm">{agent.icon}</span>
              <span
                className="text-xs"
                style={{ color: "var(--secondary)" }}
              >
                {agent.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div
          className="mt-4 rounded-2xl p-4"
          style={{
            background: "rgba(239, 68, 68, 0.08)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
          }}
        >
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      <div className="mt-6 pb-4">
        <button
          onClick={handleAnalyze}
          disabled={!listing.trim()}
          className="w-full py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
          }}
        >
          <Search className="w-5 h-5" />
          Run Analysis
        </button>
      </div>
    </div>
  );
}
