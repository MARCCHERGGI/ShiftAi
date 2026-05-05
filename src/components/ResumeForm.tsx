"use client";

import { useState, useEffect } from "react";
import { getResearch } from "@/src/lib/research-store";
import { trackEvent } from "@/src/lib/track";

const steps = [
  { title: "Personal info", fields: ["fullName", "email", "phone"] },
  { title: "Job details",   fields: ["position", "jobListing"] },
  { title: "Experience",    fields: ["summary", "skills", "experience"] },
];

type FieldSpec = {
  label: string;
  placeholder: string;
  type: "input" | "textarea" | "email" | "tel";
};

const fields: Record<string, FieldSpec> = {
  fullName:   { label: "Full name",   placeholder: "John Doe",            type: "input"    },
  email:      { label: "Email",       placeholder: "john@email.com",      type: "email"    },
  phone:      { label: "Phone",       placeholder: "(555) 123-4567",      type: "tel"      },
  position:   { label: "Position",    placeholder: "Bartender, Server…",  type: "input"    },
  jobListing: { label: "Job listing", placeholder: "Paste the job post…", type: "textarea" },
  summary:    { label: "About you",   placeholder: "Brief summary…",      type: "textarea" },
  skills:     { label: "Skills",      placeholder: "Mixology, POS…",      type: "input"    },
  experience: { label: "Experience",  placeholder: "Title, place, duties",type: "textarea" },
};

const Sparkle = () => (
  <svg viewBox="0 0 24 24" className="w-[16px] h-[16px]" fill="currentColor">
    <path d="M12 2.5 13.9 9 20 11l-6.1 2L12 19.5 10.1 13 4 11l6.1-2z" />
  </svg>
);

const Arrow = ({ left }: { left?: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    className="w-[18px] h-[18px]"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: left ? "rotate(180deg)" : "none" }}
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const Download = () => (
  <svg viewBox="0 0 24 24" className="w-[18px] h-[18px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v13M6 11l6 6 6-6M5 20h14" />
  </svg>
);

export default function ResumeForm() {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<Record<string, string>>({
    fullName: "", email: "", phone: "",
    position: "", jobListing: "",
    summary: "", skills: "", experience: "",
  });
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [hasResearch, setHasResearch] = useState(false);

  useEffect(() => {
    const r = getResearch();
    if (r) {
      setHasResearch(true);
      setData((p) => ({
        ...p,
        position: r.job.title || p.position,
        jobListing: r.rawListing || p.jobListing,
      }));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setData((p) => ({ ...p, [e.target.name]: e.target.value }));
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    const startedAt = Date.now();
    trackEvent("resume_enhance_start", { position: data.position || "unset" });
    try {
      const r = getResearch();
      if (!r) throw new Error();
      const res = await fetch("/api/resume/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userInfo: data, job: r.job, venue: r.venue }),
      });
      if (!res.ok) throw new Error();
      const enhanced = await res.json();
      setData((p) => ({
        ...p,
        summary:    enhanced.summary    || p.summary,
        skills:     enhanced.skills     || p.skills,
        experience: enhanced.experience || p.experience,
      }));
      setStep(2);
      trackEvent("resume_enhance_success", { elapsed_ms: Date.now() - startedAt });
    } catch {
      trackEvent("resume_enhance_error", { elapsed_ms: Date.now() - startedAt });
    }
    setEnhancing(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    const startedAt = Date.now();
    trackEvent("resume_download_start", {
      position: data.position || "unset",
      has_email: Boolean(data.email),
      has_phone: Boolean(data.phone),
      has_listing: Boolean(data.jobListing),
      summary_length: data.summary.length,
    });
    try {
      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.fullName || "resume"}_Jigger.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      trackEvent("resume_download_success", {
        elapsed_ms: Date.now() - startedAt,
        pdf_bytes: blob.size,
      });
    } catch {
      alert("Error generating PDF.");
      trackEvent("resume_download_error", { elapsed_ms: Date.now() - startedAt });
    } finally {
      setLoading(false);
    }
  };

  const cur = steps[step];
  const isLast = step === steps.length - 1;
  const canProceed = cur.fields.every((f) => data[f]?.trim());
  const pct = ((step + 1) / steps.length) * 100;

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center justify-between mb-3">
        <span className="footnote tabular-nums">
          {step + 1} <span style={{ color: "var(--ink-faint)" }}>/ {steps.length}</span>
          <span className="ml-2" style={{ color: "var(--ink-muted)" }}>· {cur.title}</span>
        </span>
        <span className="caption" style={{ color: "var(--ink-faint)" }}>
          {Math.round(pct)}%
        </span>
      </div>
      <div className="progress mb-10">
        <div className="progress__fill" style={{ width: `${pct}%` }} />
      </div>

      {/* Fields — line-only inputs (Linear/Stripe) */}
      <div className="space-y-4">
        {cur.fields.map((key) => {
          const f = fields[key];
          return (
            <div key={key} className="pt-1">
              <label
                className="caption block mb-1"
                style={{ color: "var(--ink-faint)" }}
              >
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  name={key}
                  value={data[key]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="input-line resize-none"
                  rows={4}
                />
              ) : (
                <input
                  type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                  name={key}
                  value={data[key]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="input-line"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* AI enhance button — last step */}
      {step === 2 && hasResearch && (
        <button
          onClick={handleEnhance}
          disabled={enhancing || !data.summary.trim()}
          className="mt-7 w-full py-3.5 rounded-[100px] subhead font-semibold flex items-center justify-center gap-2 disabled:opacity-30 press"
          style={{ background: "var(--accent-soft)", color: "var(--accent-text)" }}
        >
          <Sparkle />
          {enhancing ? "Enhancing…" : "AI enhance for this job"}
        </button>
      )}

      {/* Nav */}
      <div className="flex gap-3 mt-10">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="btn-ghost press flex-1"
          >
            <Arrow left />
            Back
          </button>
        )}
        {!isLast ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed}
            className="btn-primary press flex-1"
          >
            Next
            <Arrow />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed || loading}
            className="btn-primary press flex-1"
          >
            <Download />
            {loading ? "Generating…" : "Download PDF"}
          </button>
        )}
      </div>
    </div>
  );
}
