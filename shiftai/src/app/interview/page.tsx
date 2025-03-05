"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Mock AI-generated questions (Replace with real API)
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

  // Simulated AI response (Replace with real OpenAI API call)
  const getAIResponse = async (answer: string) => {
    setIsLoading(true);

    try {
      // Simulated API response (Replace with actual API request)
      setTimeout(() => {
        const mockResponse =
          answer.length > 20
            ? "Good response! Try adding more specific examples."
            : "Try expanding on your answer with more details.";

        setAiFeedback(`✅ AI Feedback: "${mockResponse}"`);
        setIsLoading(false);
      }, 1500);
    } catch (error) {
      setAiFeedback("❌ Error fetching AI feedback. Try again.");
      setIsLoading(false);
    }
  };

  // Handle answer submission
  const handleSubmit = () => {
    if (!userAnswer.trim()) return;
    getAIResponse(userAnswer);
  };

  // Move to next question
  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setUserAnswer("");
      setAiFeedback("");
    } else {
      router.push("/feedback");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background text-text">
      {/* 🔹 Interview Header */}
      <h1 className="text-3xl md:text-4xl font-extrabold text-primary mb-6">
        AI Interview Coach
      </h1>
      <p className="text-lg text-secondary">{questions[currentQuestion]}</p>

      {/* 🔹 Answer Input */}
      <textarea
        className="w-full md:w-2/3 bg-card p-4 rounded-md mt-4 text-text placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary transition"
        rows={4}
        placeholder="Type your answer here..."
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
      />

      {/* 🔹 AI Feedback Display */}
      {isLoading ? (
        <p className="mt-4 text-blue-400 animate-pulse">Analyzing answer...</p>
      ) : aiFeedback ? (
        <p className="mt-4 text-green-500">{aiFeedback}</p>
      ) : null}

      {/* 🔹 Buttons */}
      <div className="flex gap-4 mt-6">
        <button
          className="px-6 py-3 bg-primary hover:bg-opacity-80 text-white rounded-lg font-semibold transition"
          onClick={handleSubmit}
        >
          Submit Answer
        </button>
        <button
          className={`px-6 py-3 rounded-lg font-semibold transition ${
            aiFeedback
              ? "bg-gray-600 hover:bg-gray-700 text-white"
              : "bg-gray-400 cursor-not-allowed"
          }`}
          onClick={handleNextQuestion}
          disabled={!aiFeedback}
        >
          {currentQuestion < questions.length - 1 ? "Next Question" : "Finish Interview"}
        </button>
      </div>
    </div>
  );
}
