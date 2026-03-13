"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Send, RotateCcw } from "lucide-react";

const questions = [
  "Tell me about yourself.",
  "Why do you want to work as a bartender/server?",
  "How do you handle difficult customers?",
  "Describe a time you worked in a fast-paced environment.",
  "What do you know about responsible alcohol service?",
];

export default function InterviewPage() {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const getAIResponse = async (answer: string) => {
    setIsLoading(true);
    try {
      setTimeout(() => {
        const mockResponse =
          answer.length > 20
            ? "Good response! Try adding more specific examples."
            : "Try expanding on your answer with more details.";
        setAiFeedback(mockResponse);
        setIsLoading(false);
      }, 1500);
    } catch {
      setAiFeedback("Error fetching AI feedback. Try again.");
      setIsLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    getAIResponse(userAnswer);
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setUserAnswer("");
      setAiFeedback("");
    } else {
      router.push("/feedback");
    }
  };

  const progress = ((currentQuestion + 1) / questions.length) * 100;

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
        <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: "var(--primary)" }}>
          Interview Question
        </p>
        <h2 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>
          {questions[currentQuestion]}
        </h2>
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
        />
      </div>

      {/* AI Feedback */}
      {isLoading && (
        <div className="mt-4 rounded-2xl p-4 flex items-center gap-3" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <p className="text-sm" style={{ color: "var(--secondary)" }}>Analyzing your answer...</p>
        </div>
      )}

      {aiFeedback && !isLoading && (
        <div className="mt-4 rounded-2xl p-4" style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
          <p className="text-xs font-medium uppercase tracking-wide mb-1 text-emerald-500">AI Feedback</p>
          <p className="text-sm" style={{ color: "var(--foreground)" }}>{aiFeedback}</p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 space-y-3 pb-4">
        {!aiFeedback ? (
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
              onClick={() => { setAiFeedback(""); setUserAnswer(""); }}
              className="flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: "var(--card-bg)", border: "1.5px solid var(--card-border)", color: "var(--foreground)" }}
            >
              <RotateCcw className="w-4 h-4" />
              Retry
            </button>
            <button
              onClick={handleNextQuestion}
              className="flex-1 py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: "var(--primary)" }}
            >
              {currentQuestion < questions.length - 1 ? "Next" : "Finish"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
