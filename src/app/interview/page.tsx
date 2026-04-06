"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Send, RotateCcw } from "lucide-react";
import { getResearch, saveInterviewResults } from "@/src/lib/research-store";
import type {
  InterviewQuestion,
  AnswerEvaluation,
  InterviewResult,
} from "@/src/lib/types";

const fallbackQuestions: InterviewQuestion[] = [
  { id: 1, question: "Tell me about yourself and your bartending experience.", category: "Behavioral", difficulty: "Easy", tip: "Focus on relevant experience and passion for hospitality." },
  { id: 2, question: "How do you handle a difficult or intoxicated customer?", category: "Situational", difficulty: "Medium", tip: "Show de-escalation skills and knowledge of responsible service." },
  { id: 3, question: "What's your approach to making craft cocktails under pressure?", category: "Technical", difficulty: "Medium", tip: "Demonstrate efficiency, organization, and quality balance." },
  { id: 4, question: "Describe a time you worked effectively as part of a bar team.", category: "Behavioral", difficulty: "Easy", tip: "Use the STAR method: Situation, Task, Action, Result." },
  { id: 5, question: "What do you know about responsible alcohol service?", category: "Technical", difficulty: "Medium", tip: "Mention TIPS/ServSafe certification and specific regulations." },
  { id: 6, question: "A customer sends back their drink. What do you do?", category: "Situational", difficulty: "Medium", tip: "Show customer-first attitude without being defensive." },
  { id: 7, question: "Why do you want to work here specifically?", category: "Venue-Specific", difficulty: "Easy", tip: "Reference specific things about the venue." },
  { id: 8, question: "How do you upsell without being pushy?", category: "Technical", difficulty: "Hard", tip: "Show natural salesmanship through genuine recommendations." },
];

export default function InterviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [cur, setCur] = useState(0);
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [results, setResults] = useState<InterviewResult[]>([]);
  const [jobCtx, setJobCtx] = useState("");
  const [venueCtx, setVenueCtx] = useState("");

  useEffect(() => {
    const r = getResearch();
    if (r && r.questions && r.questions.length > 0) {
      setQuestions(r.questions);
      setJobCtx(`${r.job.title} at ${r.job.restaurant}`);
      setVenueCtx(`${r.venue.type} — ${r.venue.atmosphere}`);
    } else {
      setQuestions(fallbackQuestions);
    }
    setReady(true);
  }, []);

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questions[cur].question,
          answer,
          jobContext: jobCtx || "Bartender position",
          venueContext: venueCtx || "Restaurant/bar",
        }),
      });
      if (!res.ok) throw new Error();
      const ev: AnswerEvaluation = await res.json();
      setEvaluation(ev);
      setResults((p) => [...p, { questionId: questions[cur].id, question: questions[cur].question, answer, evaluation: ev }]);
    } catch {
      setEvaluation({
        score: answer.length > 50 ? 7 : 5,
        verdict: answer.length > 50 ? "Decent answer." : "Needs more detail.",
        strengths: ["Attempted the question"],
        improvements: ["Add specific examples"],
        sampleAnswer: "Include specific examples from past experience.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    if (cur < questions.length - 1) {
      setCur(cur + 1);
      setAnswer("");
      setEvaluation(null);
    } else {
      saveInterviewResults(results);
      router.push("/feedback");
    }
  };

  if (!ready) {
    return (
      <div className="px-5 max-w-lg mx-auto pt-12 text-center">
        <div className="spinner mx-auto" />
      </div>
    );
  }

  const q = questions[cur];
  const pct = ((cur + 1) / questions.length) * 100;

  return (
    <div className="fade-in px-5 max-w-lg mx-auto">
      {/* Progress */}
      <div className="pt-4 pb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="label">
            Question {cur + 1} of {questions.length}
          </span>
          <span className="text-xs font-medium" style={{ color: "var(--accent)" }}>
            {Math.round(pct)}%
          </span>
        </div>
        <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: "var(--surface)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${pct}%`, background: "var(--accent)" }}
          />
        </div>
      </div>

      {/* Question */}
      <div className="mt-6 mb-1">
        <div className="flex gap-1.5 mb-3">
          <span className="badge" style={{ background: "var(--accent-dim)", color: "var(--accent-text)" }}>{q.category}</span>
          <span className="badge">{q.difficulty}</span>
        </div>
        <h2 className="heading leading-snug">{q.question}</h2>
        <p className="text-xs mt-2 italic" style={{ color: "var(--text-tertiary)" }}>
          {q.tip}
        </p>
      </div>

      {/* Answer */}
      <div className="mt-4">
        <textarea
          className="input-field resize-none"
          rows={5}
          placeholder="Type your answer..."
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={!!evaluation}
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="mt-4 flex items-center gap-3">
          <div className="spinner" />
          <span className="text-sm" style={{ color: "var(--text-secondary)" }}>Evaluating...</span>
        </div>
      )}

      {/* Evaluation */}
      {evaluation && !loading && (
        <div className="mt-5 space-y-4">
          <div className="flex items-baseline justify-between" style={{ borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
            <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{evaluation.verdict}</span>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: evaluation.score >= 7 ? "var(--success)" : evaluation.score >= 5 ? "var(--accent)" : "var(--danger)" }}
            >
              {evaluation.score}<span className="text-sm font-normal" style={{ color: "var(--text-tertiary)" }}>/10</span>
            </span>
          </div>

          <div>
            <p className="label mb-2" style={{ color: "var(--success)" }}>Strengths</p>
            {evaluation.strengths.map((s, i) => (
              <p key={i} className="text-xs py-0.5" style={{ color: "var(--text-secondary)" }}>&check; {s}</p>
            ))}
          </div>

          <div>
            <p className="label mb-2" style={{ color: "var(--accent)" }}>Improve</p>
            {evaluation.improvements.map((m, i) => (
              <p key={i} className="text-xs py-0.5" style={{ color: "var(--text-secondary)" }}>&rarr; {m}</p>
            ))}
          </div>

          <div className="p-3 rounded-lg" style={{ background: "var(--surface)" }}>
            <p className="label mb-1">Example answer</p>
            <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>
              &ldquo;{evaluation.sampleAnswer}&rdquo;
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 pb-6">
        {!evaluation ? (
          <button onClick={handleSubmit} disabled={!answer.trim() || loading} className="btn-primary">
            <Send className="w-4 h-4" />
            Submit Answer
          </button>
        ) : (
          <div className="flex gap-2.5">
            <button onClick={() => { setEvaluation(null); setAnswer(""); }} className="btn-ghost flex-1">
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
            <button onClick={handleNext} className="btn-primary flex-1">
              {cur < questions.length - 1 ? "Next" : "Results"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
