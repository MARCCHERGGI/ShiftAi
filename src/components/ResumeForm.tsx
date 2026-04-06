"use client";

import { useState, useEffect } from "react";
import { Download, ChevronRight, ChevronLeft, Sparkles } from "lucide-react";
import { getResearch } from "@/src/lib/research-store";

const steps = [
  { title: "Personal Info", fields: ["fullName", "email", "phone"] },
  { title: "Job Details", fields: ["position", "jobListing"] },
  { title: "Your Experience", fields: ["summary", "skills", "experience"] },
];

const fieldConfig: Record<
  string,
  {
    label: string;
    placeholder: string;
    type: "input" | "textarea" | "email" | "tel";
  }
> = {
  fullName: { label: "Full Name", placeholder: "John Doe", type: "input" },
  email: { label: "Email", placeholder: "john@email.com", type: "email" },
  phone: { label: "Phone", placeholder: "(555) 123-4567", type: "tel" },
  position: {
    label: "Position",
    placeholder: "Bartender, Server, Chef...",
    type: "input",
  },
  jobListing: {
    label: "Job Listing",
    placeholder: "Paste the job listing here...",
    type: "textarea",
  },
  summary: {
    label: "About You",
    placeholder: "Brief summary about yourself...",
    type: "textarea",
  },
  skills: {
    label: "Skills",
    placeholder: "Mixology, POS systems, customer service...",
    type: "input",
  },
  experience: {
    label: "Experience",
    placeholder: "Last job title, company, what you did...",
    type: "textarea",
  },
};

export default function ResumeForm() {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({
    fullName: "",
    email: "",
    phone: "",
    position: "",
    jobListing: "",
    summary: "",
    skills: "",
    experience: "",
  });
  const [loading, setLoading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [hasResearch, setHasResearch] = useState(false);

  useEffect(() => {
    const research = getResearch();
    if (research) {
      setHasResearch(true);
      setFormData((prev) => ({
        ...prev,
        position: research.job.title || prev.position,
        jobListing: research.rawListing || prev.jobListing,
      }));
    }
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEnhance = async () => {
    setEnhancing(true);
    try {
      const research = getResearch();
      if (!research) throw new Error("No research data");

      const res = await fetch("/api/resume/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInfo: {
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            experience: formData.experience,
            skills: formData.skills,
            summary: formData.summary,
          },
          job: research.job,
          venue: research.venue,
        }),
      });

      if (!res.ok) throw new Error("Enhancement failed");
      const enhanced = await res.json();

      setFormData((prev) => ({
        ...prev,
        summary: enhanced.summary || prev.summary,
        skills: enhanced.skills || prev.skills,
        experience: enhanced.experience || prev.experience,
      }));

      setStep(2);
    } catch (err) {
      console.error("Enhancement failed", err);
    }
    setEnhancing(false);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/generate-resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${formData.fullName || "resume"}_ShiftAI.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      alert("Error generating PDF. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const currentStep = steps[step];
  const isLastStep = step === steps.length - 1;
  const canProceed = currentStep.fields.every((f) => formData[f]?.trim());

  return (
    <div>
      {/* Step Indicators */}
      <div className="flex items-center justify-between mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all"
              style={{
                background: i <= step ? "var(--primary)" : "var(--input-bg)",
                color: i <= step ? "white" : "var(--secondary)",
              }}
            >
              {i + 1}
            </div>
            {i < steps.length - 1 && (
              <div
                className="w-12 sm:w-20 h-0.5 mx-1"
                style={{
                  background:
                    i < step ? "var(--primary)" : "var(--input-border)",
                }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Title */}
      <h2
        className="text-lg font-semibold mb-4"
        style={{ color: "var(--foreground)" }}
      >
        {currentStep.title}
      </h2>

      {/* Fields */}
      <div className="space-y-4">
        {currentStep.fields.map((field) => {
          const config = fieldConfig[field];
          return (
            <div key={field}>
              <label
                className="text-xs font-medium mb-1.5 block"
                style={{ color: "var(--secondary)" }}
              >
                {config.label}
              </label>
              {config.type === "textarea" ? (
                <textarea
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  placeholder={config.placeholder}
                  className="input-field resize-none"
                  rows={4}
                />
              ) : (
                <input
                  type={
                    config.type === "email"
                      ? "email"
                      : config.type === "tel"
                        ? "tel"
                        : "text"
                  }
                  name={field}
                  value={formData[field]}
                  onChange={handleChange}
                  placeholder={config.placeholder}
                  className="input-field"
                />
              )}
            </div>
          );
        })}
      </div>

      {/* AI Enhance — on experience step when research exists */}
      {step === 2 && hasResearch && (
        <button
          onClick={handleEnhance}
          disabled={enhancing || !formData.summary.trim()}
          className="mt-3 w-full py-3 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
          style={{
            background:
              "linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15))",
            color: "var(--primary)",
          }}
        >
          <Sparkles className="w-4 h-4" />
          {enhancing ? "AI Enhancing..." : "AI Enhance for This Job"}
        </button>
      )}

      {/* Navigation Buttons */}
      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            style={{
              background: "var(--card-bg)",
              border: "1.5px solid var(--card-border)",
              color: "var(--foreground)",
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
        )}
        {!isLastStep ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed}
            className="flex-1 py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--primary)" }}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed || loading}
            className="flex-1 py-4 rounded-2xl font-semibold text-white text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-40"
            style={{ background: "var(--primary)" }}
          >
            <Download className="w-4 h-4" />
            {loading ? "Generating..." : "Download PDF"}
          </button>
        )}
      </div>
    </div>
  );
}
