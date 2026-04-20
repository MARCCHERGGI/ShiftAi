"use client";

import { useState, useEffect } from "react";
import { Download, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { getResearch } from "@/src/lib/research-store";
import { trackEvent } from "@/src/lib/track";

const steps = [
  { title: "Personal Info", fields: ["fullName", "email", "phone"] },
  { title: "Job Details", fields: ["position", "jobListing"] },
  { title: "Experience", fields: ["summary", "skills", "experience"] },
];

const fields: Record<string, { label: string; placeholder: string; type: "input" | "textarea" | "email" | "tel" }> = {
  fullName: { label: "Full Name", placeholder: "John Doe", type: "input" },
  email: { label: "Email", placeholder: "john@email.com", type: "email" },
  phone: { label: "Phone", placeholder: "(555) 123-4567", type: "tel" },
  position: { label: "Position", placeholder: "Bartender, Server...", type: "input" },
  jobListing: { label: "Job Listing", placeholder: "Paste the job listing...", type: "textarea" },
  summary: { label: "About You", placeholder: "Brief summary...", type: "textarea" },
  skills: { label: "Skills", placeholder: "Mixology, POS systems...", type: "input" },
  experience: { label: "Experience", placeholder: "Job title, company, duties...", type: "textarea" },
};

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
        summary: enhanced.summary || p.summary,
        skills: enhanced.skills || p.skills,
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
      a.download = `${data.fullName || "resume"}_ShiftAI.pdf`;
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

  return (
    <div>
      {/* Progress */}
      <div className="flex items-center gap-1 mb-6">
        <p className="label">
          Step {step + 1} of {steps.length}
        </p>
        <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          &mdash; {cur.title}
        </span>
      </div>
      <div className="w-full h-1 rounded-full mb-6" style={{ background: "var(--surface)" }}>
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${((step + 1) / steps.length) * 100}%`, background: "var(--accent)" }}
        />
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {cur.fields.map((key) => {
          const f = fields[key];
          return (
            <div key={key}>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--text-secondary)" }}>
                {f.label}
              </label>
              {f.type === "textarea" ? (
                <textarea
                  name={key}
                  value={data[key]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="input-field resize-none"
                  rows={4}
                />
              ) : (
                <input
                  type={f.type === "email" ? "email" : f.type === "tel" ? "tel" : "text"}
                  name={key}
                  value={data[key]}
                  onChange={handleChange}
                  placeholder={f.placeholder}
                  className="input-field"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* AI Enhance */}
      {step === 2 && hasResearch && (
        <button
          onClick={handleEnhance}
          disabled={enhancing || !data.summary.trim()}
          className="mt-3 w-full py-2.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-colors disabled:opacity-35"
          style={{ background: "var(--accent-dim)", color: "var(--accent-text)" }}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {enhancing ? "Enhancing..." : "AI Enhance for This Job"}
        </button>
      )}

      {/* Nav */}
      <div className="flex gap-2.5 mt-6">
        {step > 0 && (
          <button onClick={() => setStep(step - 1)} className="btn-ghost flex-1">
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        {!isLast ? (
          <button onClick={() => setStep(step + 1)} disabled={!canProceed} className="btn-primary flex-1">
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={!canProceed || loading} className="btn-primary flex-1">
            <Download className="w-4 h-4" />
            {loading ? "Generating..." : "Download PDF"}
          </button>
        )}
      </div>
    </div>
  );
}
