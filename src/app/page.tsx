"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, useCallback } from "react";
import { FileText, MessageSquare, Sparkles, Target, Zap, Search } from "lucide-react";

export default function HomePage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeCard, setActiveCard] = useState(0);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollLeft = el.scrollLeft;
    const cardWidth = el.firstElementChild?.clientWidth || 1;
    const gap = 16;
    const index = Math.round(scrollLeft / (cardWidth + gap));
    setActiveCard(index);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  return (
    <div className="page-enter px-5 max-w-lg mx-auto">
      {/* Greeting */}
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Land your dream
          <br />
          <span className="bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">
            bartender job
          </span>
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--secondary)" }}>
          AI agents that research, prep interviews &amp; build your resume
        </p>
      </div>

      {/* Swipable Feature Cards */}
      <div
        ref={scrollRef}
        className="swipe-container -mx-5 px-5 py-2"
        style={{ gap: "16px" }}
      >
        {/* Analyze Job Card */}
        <button
          onClick={() => router.push("/jobs")}
          className="swipe-card rounded-2xl p-6 text-left transition-transform active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #f59e0b, #d97706)",
            minHeight: "200px",
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
            <Search className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Analyze a Job</h2>
          <p className="text-white/80 text-sm mt-2">
            Paste any listing — AI agents research the restaurant, location, pay &amp; more
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-white/90 text-sm font-medium">
            Start research
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </button>

        {/* Resume Card */}
        <button
          onClick={() => router.push("/resume-builder")}
          className="swipe-card rounded-2xl p-6 text-left transition-transform active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
            minHeight: "200px",
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Build Resume</h2>
          <p className="text-white/80 text-sm mt-2">
            AI-tailored resume for any bartender position — download as PDF
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-white/90 text-sm font-medium">
            Get started
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </button>

        {/* Interview Card */}
        <button
          onClick={() => router.push("/interview")}
          className="swipe-card rounded-2xl p-6 text-left transition-transform active:scale-[0.98]"
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            minHeight: "200px",
          }}
        >
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center mb-4">
            <MessageSquare className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Mock Interview</h2>
          <p className="text-white/80 text-sm mt-2">
            Practice with AI-generated questions and get real coaching feedback
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-white/90 text-sm font-medium">
            Start practicing
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </div>
        </button>
      </div>

      {/* Swipe Indicators */}
      <div className="flex justify-center gap-2 mt-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`dot ${activeCard === i ? "active" : ""}`} />
        ))}
      </div>

      {/* Quick Stats */}
      <div className="mt-8 grid grid-cols-3 gap-3">
        <div className="rounded-2xl p-4 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <Zap className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--primary)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>6 Agents</p>
          <p className="text-[10px]" style={{ color: "var(--secondary)" }}>Deep Research</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <Target className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--primary)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>AI Coach</p>
          <p className="text-[10px]" style={{ color: "var(--secondary)" }}>Real Feedback</p>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
          <Sparkles className="w-5 h-5 mx-auto mb-2" style={{ color: "var(--primary)" }} />
          <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>Smart</p>
          <p className="text-[10px]" style={{ color: "var(--secondary)" }}>Resume AI</p>
        </div>
      </div>

      {/* CTA */}
      <div className="mt-8 pb-4">
        <button
          onClick={() => router.push("/jobs")}
          className="w-full py-4 rounded-2xl font-semibold text-white text-base transition-all active:scale-[0.98]"
          style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
        >
          Analyze a Job Listing
        </button>
      </div>
    </div>
  );
}
