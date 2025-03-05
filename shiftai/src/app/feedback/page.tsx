"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Simulated AI-generated feedback (Replace with real API)
const generateFeedback = () => ({
  score: Math.floor(Math.random() * 101), // Randomized score out of 100
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-background text-text">
      {/* 🔹 Page Title */}
      <h1 className="text-3xl md:text-4xl font-extrabold text-primary mb-4">
        Interview Feedback
      </h1>
      <p className="text-lg text-secondary">
        Here’s how you performed in your AI interview.
      </p>

      {/* 🔹 Score Section */}
      <div className="mt-6 text-center bg-card p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-semibold">Your Score</h2>
        <p className="text-5xl font-bold text-green-400 mt-2 transition-transform hover:scale-110">
          {feedback.score}/100
        </p>
      </div>

      {/* 🔹 Strengths Section */}
      <div className="mt-6 w-full md:w-2/3 bg-card p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-green-400">Strengths</h2>
        <ul className="mt-2 space-y-2">
          {feedback.strengths.map((strength, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-text bg-gray-800 dark:bg-gray-700 px-4 py-2 rounded-md"
            >
              ✅ {strength}
            </li>
          ))}
        </ul>
      </div>

      {/* 🔹 Areas to Improve */}
      <div className="mt-6 w-full md:w-2/3 bg-card p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold text-red-400">Areas to Improve</h2>
        <ul className="mt-2 space-y-2">
          {feedback.areasToImprove.map((area, index) => (
            <li
              key={index}
              className="flex items-center gap-2 text-text bg-gray-800 dark:bg-gray-700 px-4 py-2 rounded-md"
            >
              ⚠️ {area}
            </li>
          ))}
        </ul>
      </div>

      {/* 🔹 Action Buttons */}
      <div className="flex gap-4 mt-8">
        <button
          className="px-6 py-3 bg-primary hover:bg-opacity-80 text-white rounded-lg font-semibold transition"
          onClick={() => router.push("/interview")}
        >
          Retry Interview
        </button>
        <button
          className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition"
          onClick={() => router.push("/")}
        >
          Exit
        </button>
      </div>
    </div>
  );
}
