"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Home, CheckCircle, AlertTriangle } from "lucide-react";

const generateFeedback = () => ({
  score: Math.floor(Math.random() * 41) + 60, // 60-100
  strengths: [
    "Good communication skills",
    "Clear and concise answers",
    "Confidence in responses",
  ],
  areasToImprove: [
    "Provide more specific examples",
    "Elaborate on your past experiences",
    "Use industry-specific terminology",
  ],
});

export default function FeedbackPage() {
  const router = useRouter();
  const [feedback] = useState(generateFeedback());

  const getScoreColor = (score: number) => {
    if (score >= 80) return "#10b981";
    if (score >= 60) return "#f59e0b";
    return "#ef4444";
  };

  return (
    <div className="page-enter px-5 max-w-lg mx-auto">
      <div className="pt-6 pb-4 text-center">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Your Results
        </h1>
      </div>

      {/* Score Circle */}
      <div className="flex justify-center py-6">
        <div
          className="w-32 h-32 rounded-full flex flex-col items-center justify-center"
          style={{
            border: `4px solid ${getScoreColor(feedback.score)}`,
            background: `${getScoreColor(feedback.score)}10`,
          }}
        >
          <span className="text-3xl font-bold" style={{ color: getScoreColor(feedback.score) }}>
            {feedback.score}
          </span>
          <span className="text-xs" style={{ color: "var(--secondary)" }}>out of 100</span>
        </div>
      </div>

      {/* Strengths */}
      <div className="rounded-2xl p-4 mb-3" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-emerald-500">
          <CheckCircle className="w-4 h-4" />
          Strengths
        </h3>
        <div className="space-y-2">
          {feedback.strengths.map((s, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl" style={{ background: "rgba(16, 185, 129, 0.06)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
              <p className="text-sm" style={{ color: "var(--foreground)" }}>{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Areas to Improve */}
      <div className="rounded-2xl p-4 mb-6" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3 text-amber-500">
          <AlertTriangle className="w-4 h-4" />
          Areas to Improve
        </h3>
        <div className="space-y-2">
          {feedback.areasToImprove.map((a, i) => (
            <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl" style={{ background: "rgba(245, 158, 11, 0.06)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
              <p className="text-sm" style={{ color: "var(--foreground)" }}>{a}</p>
            </div>
          ))}
        </div>
      </div>

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
          onClick={() => router.push("/")}
          className="flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{ background: "var(--card-bg)", border: "1.5px solid var(--card-border)", color: "var(--foreground)" }}
        >
          <Home className="w-4 h-4" />
          Home
        </button>
      </div>
    </div>
  );
}
