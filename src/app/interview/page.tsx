"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Send, RotateCcw, Loader2 } from "lucide-react";
import { getResearch, saveInterviewResults } from "@/src/lib/research-store";
import type { InterviewQuestion, AnswerEvaluation, InterviewResult } from "@/src/lib/types";

const fallbackQuestions: InterviewQuestion[] = [
  { id: 1, question: "Tell me about yourself and your bartending experience.", category: "Behavioral", difficulty: "Easy", tip: "Focus on relevant experience and passion for hospitality." },
  { id: 2, question: "How do you handle a difficult or intoxicated customer?", category: "Situational", difficulty: "Medium", tip: "Show de-escalation skills and knowledge of responsible service." },
  { id: 3, question: "What's your approach to making craft cocktails under pressure during a rush?", category: "Technical", difficulty: "Medium", tip: "Demonstrate efficiency, organization, and quality balance." },
  { id: 4, question: "Describe a time you worked effectively as part of a bar team.", category: "Behavioral", difficulty: "Easy", tip: "Use the STAR method — Situation, Task, Action, Result." },
  { id: 5, question: "What do you know about responsible alcohol service and local regulations?", category: "Technical", difficulty: "Medium", tip: "Mention TIPS/ServSafe certification and specific laws." },
  { id: 6, question: "A customer sends back their drink saying it doesn't taste right. What do you do?", category: "Situational", difficulty: "Medium", tip: "Show customer-first attitude without being defensive." },
  { id: 7, question: "Why do you want to work here specifically?", category: "Venue-Specific", difficulty: "Easy", tip: "Reference specific things about the venue that appeal to you." },
  { id: 8, question: "How do you upsell drinks and food without being pushy?", category: "Technical", difficulty: "Hard", tip: "Show natural salesmanship through genuine recommendations." },
];

export default function InterviewPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<AnswerEvaluation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(true);
  const [results, setResults] = useState<InterviewResult[]>([]);
  const [jobContext, setJobContext] = useState("");
  const [venueContext, setVenueContext] = useState("");

  useEffect(() => {
    const research = getResearch();
    if (research && research.questions && research.questions.length > 0) {
      setQuestions(research.questions);
      setJobContext(`${research.job.title} at ${research.job.restaurant}`);
      setVenueContext(`${research.venue.type} — ${research.venue.atmosphere}`);
    } else {
      setQuestions(fallbackQuestions);
    }
    setIsLoadingQuestions(false);
  }, []);

  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    setIsLoading(true);

    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questions[currentQuestion].question,
          answer: userAnswer,
          jobContext: jobContext || "Bartender position",
          venueContext: venueContext || "Restaurant/bar",
        }),
      });

      if (!res.ok) throw new Error("Evaluation failed");

      const evalData: AnswerEvaluation = await res.json();
      setEvaluation(evalData);

      setResults((prev) => [
        ...prev,
        {
          questionId: questions[currentQuestion].id,
          question: questions[currentQuestion].question,
          answer: userAnswer,
          evaluation: evalData,
        },
      ]);
    } catch {
      setEvaluation({
        score: userAnswer.length > 50 ? 7 : 5,
        verdict: userAnswer.length > 50 ? "Decent answer with good detail." : "Could use more detail and specific examples.",
        strengths: ["Attempted the question", "Showed willingness to engage"],
        improvements: ["Add specific examples from past experience", "Connect your answer to the role requirements"],
        sampleAnswer: "A strong answer would include specific examples from past experience and connect directly to what this role requires.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setUserAnswer("");
      setEvaluation(null);
    } else {
      saveInterviewResults(results);
      router.push("/feedback");
    }
  };

  if (isLoadingQuestions) {
    return (
      <div className="page-enter px-5 max-w-lg mx-auto pt-10 text-center">
        <Loader2 className="w-8 h-8 mx-auto animate-spin" style={{ color: "var(--primary)" }} />
        <p className="mt-3 text-sm" style={{ color: "var(--secondary)" }}>Loading questions...</p>
      </div>
    );
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  const q = questions[currentQuestion];

  return (
    <div className="page-enter px-5 max-w-lg mx-auto">
      {/* Progress Bar */}
      <div className="pt-4 pb-2">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs font-medium" style={{ color: "var(--secondary)" }}>
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span className="text-xs font-semibold" style={{ color: "var(--primary)" }}>
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--input-bg)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${progress}%`, background: "var(--primary)" }}
          />
        </div>
      </div>

      {/* Question Card */}
      <div className="mt-6 rounded-2xl p-5" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <span
            className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: "rgba(99, 102, 241, 0.1)", color: "var(--primary)" }}
          >
            {q.category}
          </span>
          <span
            className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: "var(--input-bg)", color: "var(--secondary)" }}
          >
            {q.difficulty}
          </span>
        </div>
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {q.question}
        </h2>
        <p className="text-xs mt-2" style={{ color: "var(--secondary)" }}>
          Tip: {q.tip}
        </p>
      </div>

      {/* Answer Input */}
      <div className="mt-4">
        <textarea
          className="input-field resize-none"
          rows={5}
          placeholder="Type your answer here..."
          value={userAnswer}
          onChange={(e) => setUserAnswer(e.target.value)}
          style={{ borderRadius: "16px" }}
          disabled={!!evaluation}
        />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="mt-4 rounded-2xl p-4 flex items-center gap-3" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--primary)" }} />
          <p className="text-sm" style={{ color: "var(--secondary)" }}>AI Coach evaluating your answer...</p>
        </div>
      )}

      {/* AI Evaluation */}
      {evaluation && !isLoading && (
        <div className="mt-4 space-y-3">
          {/* Score */}
          <div className="rounded-2xl p-4" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--primary)" }}>Score</span>
              <span
                className="text-2xl font-bold"
                style={{ color: evaluation.score >= 7 ? "#10b981" : evaluation.score >= 5 ? "#f59e0b" : "#ef4444" }}
              >
                {evaluation.score}/10
              </span>
            </div>
            <p className="text-sm" style={{ color: "var(--foreground)" }}>{evaluation.verdict}</p>
          </div>

          {/* Strengths */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(16, 185, 129, 0.06)", border: "1px solid rgba(16, 185, 129, 0.15)" }}>
            <p className="text-xs font-medium text-emerald-500 mb-2">Strengths</p>
            {evaluation.strengths.map((s, i) => (
              <p key={i} className="text-xs py-0.5" style={{ color: "var(--foreground)" }}>&#10003; {s}</p>
            ))}
          </div>

          {/* Improvements */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(245, 158, 11, 0.06)", border: "1px solid rgba(245, 158, 11, 0.15)" }}>
            <p className="text-xs font-medium text-amber-500 mb-2">To Improve</p>
            {evaluation.improvements.map((imp, i) => (
              <p key={i} className="text-xs py-0.5" style={{ color: "var(--foreground)" }}>&rarr; {imp}</p>
            ))}
          </div>

          {/* Sample Answer */}
          <div className="rounded-2xl p-4" style={{ background: "var(--input-bg)" }}>
            <p className="text-xs font-medium mb-2" style={{ color: "var(--primary)" }}>Strong Answer Example</p>
            <p className="text-xs italic" style={{ color: "var(--foreground)" }}>&ldquo;{evaluation.sampleAnswer}&rdquo;</p>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 space-y-3 pb-4">
        {!evaluation ? (
          <button
            onClick={handleSubmit}
            disabled={!userAnswer.trim() || isLoading}
            className="w-full py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--primary)" }}
          >
            <Send className="w-4 h-4" />
            Submit Answer
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={() => { setEvaluation(null); setUserAnswer(""); }}
              className="flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: "var(--card-bg)", border: "1.5px solid var(--card-border)", color: "var(--foreground)" }}
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              {currentQuestion < questions.length - 1 ? "Next" : "See Results"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
