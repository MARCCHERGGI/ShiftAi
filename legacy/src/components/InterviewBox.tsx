"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface InterviewBoxProps {
  questions: string[];
  getAIResponse: (answer: string) => Promise<string>;
}

export default function InterviewBox({ questions, getAIResponse }: InterviewBoxProps) {
  const router = useRouter();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userAnswer, setUserAnswer] = useState("");
  const [aiFeedback, setAiFeedback] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Handle AI Feedback Request
  const handleSubmit = async () => {
    if (!userAnswer.trim()) return;
    setIsLoading(true);
    const feedback = await getAIResponse(userAnswer);
    setAiFeedback(feedback);
    setIsLoading(false);
  };

  // Handle Next Question
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
    <div className="bg-gray-900 text-white dark:bg-white dark:text-black p-6 rounded-lg shadow-lg w-full max-w-3xl mx-auto">
      {/* 🔹 Question Display */}
      <h2 className="text-2xl font-bold text-blue-400 mb-4">{questions[currentQuestion]}</h2>

      {/* 🔹 Answer Input */}
      <textarea
        className="w-full bg-gray-800 dark:bg-gray-200 p-3 rounded-md text-white dark:text-black placeholder-gray-500 focus:outline-none"
        rows={4}
        placeholder="Type your answer here..."
        value={userAnswer}
        onChange={(e) => setUserAnswer(e.target.value)}
      />

      {/* 🔹 AI Feedback */}
      {isLoading ? (
        <p className="mt-3 text-blue-300">Analyzing answer...</p>
      ) : aiFeedback ? (
        <p className="mt-3 text-green-400">{aiFeedback}</p>
      ) : null}

      {/* 🔹 Buttons */}
      <div className="flex gap-4 mt-6">
        <button
          className="px-6 py-3 bg-blue-500 hover:bg-blue-600 rounded-lg text-lg font-semibold transition"
          onClick={handleSubmit}
        >
          Submit Answer
        </button>
        <button
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-300 rounded-lg text-lg font-semibold transition"
          onClick={handleNextQuestion}
          disabled={!aiFeedback}
        >
          {currentQuestion < questions.length - 1 ? "Next Question" : "Finish Interview"}
        </button>
      </div>
    </div>
  );
}

