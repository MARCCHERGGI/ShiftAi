"use client";
import ResumeForm from "@/src/components/ResumeForm";

export default function ResumeBuilderPage() {
  return (
    <div className="page-enter px-5 max-w-lg mx-auto">
      <div className="pt-6 pb-4">
        <h1 className="text-2xl font-bold" style={{ color: "var(--foreground)" }}>
          Resume Builder
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--secondary)" }}>
          Fill in your details and AI will generate a polished PDF
        </p>
      </div>
      <ResumeForm />
    </div>
  );
}
