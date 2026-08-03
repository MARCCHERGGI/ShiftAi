"use client";
import ResumeForm from "@/src/components/ResumeForm";

export default function ResumeBuilderPage() {
  return (
    <div className="fade-in px-5 max-w-lg mx-auto">
      <div className="pt-8 pb-6">
        <h1 className="display">
          Build your<br />resume.
        </h1>
        <p
          className="mt-3 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Fill in your details. AI generates a polished PDF tailored to the position.
        </p>
      </div>
      <ResumeForm />
      <div className="h-6" />
    </div>
  );
}
