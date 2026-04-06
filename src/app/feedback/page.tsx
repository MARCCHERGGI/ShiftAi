"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Search, ChevronDown, ChevronUp } from "lucide-react";
import { getInterviewResults } from "@/src/lib/research-store";
import type { InterviewResult } from "@/src/lib/types";

export default function FeedbackPage() {
  const router = useRouter();
  const [results, setResults] = useState<InterviewResult[]>([]);
  const [score, setScore] = useState(0);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [strengths, setStrengths] = useState<string[]>([]);
  const [improvements, setImprovements] = useState<string[]>([]);

  useEffect(() => {
    const saved = getInterviewResults();
    if (saved && saved.length > 0) {
      setResults(saved);
      setScore(Math.round((saved.reduce((s, r) => s + (r.evaluation?.score || 0), 0) / saved.length) * 10));
      const str = new Set<string>();
      const imp = new Set<string>();
      saved.forEach((r) => {
        r.evaluation?.strengths?.forEach((s) => str.add(s));
        r.evaluation?.improvements?.forEach((i) => imp.add(i));
      });
      setStrengths(Array.from(str).slice(0, 4));
      setImprovements(Array.from(imp).slice(0, 4));
    } else {
      setScore(70);
      setStrengths(["Good communication", "Showed enthusiasm"]);
      setImprovements(["Add specific examples", "Research the venue"]);
    }
  }, []);

  const scoreColor = score >= 80 ? "var(--success)" : score >= 60 ? "var(--accent)" : "var(--danger)";

  return (
    <div className="fade-in px-5 max-w-lg mx-auto">
      {/* Score */}
      <div className="pt-10 pb-8 text-center">
        <p className="label mb-3">Overall score</p>
        <p className="text-6xl font-bold tabular-nums" style={{ color: scoreColor, letterSpacing: "-0.04em" }}>
          {score}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>out of 100</p>
        {results.length > 0 && (
          <p className="text-xs mt-3" style={{ color: "var(--text-tertiary)" }}>
            {results.length} questions completed
          </p>
        )}
      </div>

      {/* Strengths */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="py-4">
        <p className="label mb-3" style={{ color: "var(--success)" }}>Strengths</p>
        {strengths.map((s, i) => (
          <p key={i} className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>
            &check; {s}
          </p>
        ))}
      </div>

      {/* Improvements */}
      <div style={{ borderTop: "1px solid var(--border)" }} className="py-4">
        <p className="label mb-3" style={{ color: "var(--accent)" }}>Areas to improve</p>
        {improvements.map((m, i) => (
          <p key={i} className="text-sm py-1" style={{ color: "var(--text-secondary)" }}>
            &rarr; {m}
          </p>
        ))}
      </div>

      {/* Breakdown */}
      {results.length > 0 && (
        <div style={{ borderTop: "1px solid var(--border)" }} className="py-4">
          <p className="label mb-3">Question breakdown</p>
          <div className="space-y-1">
            {results.map((r, i) => (
              <div key={i}>
                <button
                  onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  className="w-full flex items-center gap-2.5 py-2 text-left"
                >
                  <span
                    className="text-xs font-bold w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 tabular-nums"
                    style={{
                      background: r.evaluation.score >= 7 ? "var(--success-dim)" : r.evaluation.score >= 5 ? "var(--accent-dim)" : "var(--danger-dim)",
                      color: r.evaluation.score >= 7 ? "var(--success)" : r.evaluation.score >= 5 ? "var(--accent)" : "var(--danger)",
                    }}
                  >
                    {r.evaluation.score}
                  </span>
                  <span className="text-xs flex-1 truncate" style={{ color: "var(--text-secondary)" }}>
                    {r.question}
                  </span>
                  {expandedQ === i ? (
                    <ChevronUp className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  ) : (
                    <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: "var(--text-tertiary)" }} />
                  )}
                </button>
                {expandedQ === i && (
                  <div className="pl-8 pb-3 text-xs space-y-1" style={{ color: "var(--text-tertiary)" }}>
                    <p><span style={{ color: "var(--text-secondary)" }}>You said:</span> {r.answer}</p>
                    <p><span style={{ color: "var(--text-secondary)" }}>Verdict:</span> {r.evaluation.verdict}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2.5 mt-4 pb-6">
        <button onClick={() => router.push("/interview")} className="btn-primary flex-1">
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
        <button onClick={() => router.push("/jobs")} className="btn-ghost flex-1">
          <Search className="w-4 h-4" />
          New Job
        </button>
      </div>
    </div>
  );
}
