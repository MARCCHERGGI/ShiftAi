"use client";

import { useRouter } from "next/navigation";

// 🔹 Home Page (Root)
export default function HomePage() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12 bg-background text-text">
      {/* 🔹 Hero Section */}
      <section className="text-center max-w-3xl">
        <h1 className="text-4xl md:text-6xl font-extrabold leading-tight">
          AI for <span className="text-primary">Restaurant Jobs</span>
        </h1>
        <p className="mt-4 text-lg text-secondary">
          Simplify interviews. Build resumes. Land your dream job with ShiftAI.
        </p>

        {/* 🔹 Hero Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-6">
          <button
            className="px-8 py-3 bg-primary hover:bg-opacity-80 text-white font-semibold rounded-lg transition"
            onClick={() => router.push("/interview")}
          >
            Practice Interviews
          </button>
          <button
            className="px-8 py-3 bg-green-500 hover:bg-green-600 text-white font-semibold rounded-lg transition"
            onClick={() => router.push("/resume-builder")}
          >
            Build Resume
          </button>
        </div>
      </section>

      {/* 🔹 AI Features Section */}
      <section className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center max-w-4xl">
        <FeatureCard
          title="⚡ Instant Feedback"
          description="Get AI-driven insights fast."
        />
        <FeatureCard
          title="🎯 Targeted Prompts"
          description="Practice with curated, job-specific questions."
        />
        <FeatureCard
          title="📄 Resume & Profile Boost"
          description="Optimize your resume for maximum impact."
        />
      </section>
    </div>
  );
}

// 🔹 FeatureCard Component
function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="bg-card p-6 rounded-lg shadow-md hover:shadow-lg transition">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-secondary mt-2">{description}</p>
    </div>
  );
}
