"use client";
import ResumeForm from "@/src/components/ResumeForm";  // ✅ Updated import

export default function ResumeBuilderPage() {
  return (
    <div className="container">
      <h1 className="text-center">AI-Powered Resume Builder</h1>
      <p className="text-center">
        Generate a job-winning resume tailored to your desired job.
      </p>
      <ResumeForm />
    </div>
  );
}
