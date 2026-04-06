"use client";

import { useRouter } from "next/navigation";
import { Search, FileText, MessageSquare, ChevronRight } from "lucide-react";

const actions = [
  {
    href: "/jobs",
    icon: Search,
    title: "Analyze a Listing",
    desc: "Paste any job post. AI researches the restaurant, location, and pay.",
  },
  {
    href: "/resume-builder",
    icon: FileText,
    title: "Build Resume",
    desc: "Tailored to the specific position. Download as PDF.",
  },
  {
    href: "/interview",
    icon: MessageSquare,
    title: "Mock Interview",
    desc: "Practice with AI-generated questions and real coaching.",
  },
];

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="fade-in px-5 max-w-lg mx-auto">
      <div className="pt-10 pb-8">
        <h1 className="display">
          Find your
          <br />
          next shift.
        </h1>
        <p
          className="mt-4 text-sm leading-relaxed max-w-[300px]"
          style={{ color: "var(--text-secondary)" }}
        >
          AI agents that research listings, profile restaurants, prep
          interviews, and build resumes.
        </p>
      </div>

      <div>
        {actions.map(({ href, icon: Icon, title, desc }, i) => (
          <button
            key={href}
            onClick={() => router.push(href)}
            className={`fade-in stagger-${i + 1} w-full text-left py-5 flex items-start gap-4`}
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--accent-dim)" }}
            >
              <Icon className="w-[18px] h-[18px]" style={{ color: "var(--accent)" }} />
            </div>
            <div className="flex-1 min-w-0">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text)", letterSpacing: "-0.01em" }}
              >
                {title}
              </p>
              <p
                className="text-xs mt-0.5 leading-relaxed"
                style={{ color: "var(--text-tertiary)" }}
              >
                {desc}
              </p>
            </div>
            <ChevronRight
              className="w-4 h-4 mt-1.5 flex-shrink-0"
              style={{ color: "var(--text-tertiary)" }}
            />
          </button>
        ))}
      </div>

      <div className="mt-10 pb-6">
        <button onClick={() => router.push("/jobs")} className="btn-primary">
          <Search className="w-4 h-4" />
          Analyze a Job Listing
        </button>
      </div>
    </div>
  );
}
