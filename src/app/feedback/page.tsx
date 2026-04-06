"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, Search } from "lucide-react";
import { getInterviewResults } from "@/src/lib/research-store";
import type { InterviewResult } from "@/src/lib/types";

export default function FeedbackPage() {
  const router = useRouter();
  const [results, setResults] = useState<InterviewResult[]>([]);
  const [overallScore, setOverallScore] = useState(0);
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [allStrengths, setAllStrengths] = useState<string[]>([]);
  const [allImprovements, setAllImprovements] = useState<string[]>([]);

  useEffect(() => {
    const saved = getInterviewResults();
    if (saved && saved.length > 0) {
      setResults(saved);
      const avg = Math.round(
        (saved.reduce((sum, r) => sum + (r.evaluation?.score || 0), 0) /
          saved.length) *
          10
      );
      setOverallScore(avg);

      const strengths = new Set<string>();
      const improvements = new Set<string>();
      saved.forEach((r) => {
        r.evaluation?.strengths?.forEach((s) => strengths.add(s));
        r.evaluation?.improvements?.forEach((imp) => improvements.add(imp));
      });
      setAllStrengths(Array.from(strengths).slice(0, 5));
      setAllImprovements(Array.from(improvements).slice(0, 5));
    } else {
      setOverallScore(70);
      setAllStrengths([
        "Showed enthusiasm",
        "Good communication",
        "Willing to learn",
      ]);
      setAllImprovements([
        "Add specific examples",
        "Research the venue beforehand",
        "Practice the STAR method",
      ]);
    }
  }, []);

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="page-enter px-5 max-w-lg mx-auto">
      <div className="pt-6 pb-4 text-center">
        <h1
          className="text-2xl font-bold"
          style={{ color: "var(--foreground)" }}
        >
          Your Results
        </h1>
        {results.length > 0 && (
          <p className="text-sm mt-1" style={{ color: "var(--secondary)" }}>
            {results.length} questions completed
          </p>
        )}
      </div>

      {/* Score Circle */}
      <div className="flex justify-center py-6">
        <div
          className="w-32 h-32 rounded-full flex flex-col items-center justify-center"
          style={{
            border: `4px solid ${getScoreColor(overallScore)}`,
            background: `${getScoreColor(overallScore)}10`,
          }}
        >
          <span
            className="text-3xl font-bold"
            style={{ color: getScoreColor(overallScore) }}
          >
            {overallScore}
          </span>
          <span className="text-xs" style={{ color: "var(--secondary)" }}>
            out of 100
          </span>
        </div>
      </div>

      {/* Strengths */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-emerald-500">
          <CheckCircle className="w-4 h-4" />
          Strengths
        </h3>
        <div className="space-y-2">
          {allStrengths.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 px-3 rounded-xl"
              style={{ background: "rgba(16, 185, 129, 0.06)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <p className="text-sm" style={{ color: "var(--foreground)" }}>
                {s}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Areas to Improve */}
      <div
        className="rounded-2xl p-4 mb-3"
        style={{
          background: "var(--card-bg)",
          border: "1px solid var(--card-border)",
        }}
      >
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-amber-500">
          <AlertTriangle className="w-4 h-4" />
          Areas to Improve
        </h3>
        <div className="space-y-2">
          {allImprovements.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2 px-3 rounded-xl"
              style={{ background: "rgba(245, 158, 11, 0.06)" }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <p className="text-sm" style={{ color: "var(--foreground)" }}>
                {a}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Per-Question Breakdown */}
      {results.length > 0 && (
        <div
          className="rounded-2xl p-4 mb-6"
          style={{
            background: "var(--card-bg)",
            border: "1px solid var(--card-border)",
          }}
        >
          <h3
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--foreground)" }}
          >
            Question Breakdown
          </h3>
          <div className="space-y-2">
            {results.map((r, i) => (
              <div key={i}>
                <button
                  onClick={() =>
                    setExpandedQ(expandedQ === i ? null : i)
                  }
                  className="w-full flex items-center justify-between py-2 px-3 rounded-xl text-left"
                  style={{ background: "var(--input-bg)" }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span
                      className="text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `${getScoreColor(r.evaluation.score * 10)}15`,
                        color: getScoreColor(r.evaluation.score * 10),
                      }}
                    >
                      {r.evaluation.score}
                    </span>
                    <span
                      className="text-xs truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      Q{i + 1}: {r.question}
                    </span>
                  </div>
                  {expandedQ === i ? (
                    <ChevronUp
                      className="w-3 h-3 flex-shrink-0"
                      style={{ color: "var(--secondary)" }}
                    />
                  ) : (
                    <ChevronDown
                      className="w-3 h-3 flex-shrink-0"
                      style={{ color: "var(--secondary)" }}
                    />
                  )}
                </button>
                {expandedQ === i && (
                  <div
                    className="mt-1 px-3 py-2 text-xs space-y-1"
                    style={{ color: "var(--secondary)" }}
                  >
                    <p>
                      <strong style={{ color: "var(--foreground)" }}>
                        Your answer:
                      </strong>{" "}
                      {r.answer}
                    </p>
                    <p>
                      <strong style={{ color: "var(--foreground)" }}>
                        Verdict:
                      </strong>{" "}
                      {r.evaluation.verdict}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={() => router.push("/interview")}
          className="flex-1 py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: "var(--primary)" }}
        >
          <RotateCcw className="w-4 h-4" />
          Try Again
        </button>
        <button
          onClick={() => router.push("/jobs")}
          className="flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            background: "var(--card-bg)",
            border: "1.5px solid var(--card-border)",
            color: "var(--foreground)",
          }}
        >
          <Search className="w-4 h-4" />
          New Job
        </button>
      </div>
    </div>
  );
}
