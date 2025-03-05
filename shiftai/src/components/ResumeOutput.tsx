"use client";
export default function ResumeOutput({ resume }: { resume: string }) {
  return (
    <div className="resume-output">
      <h2>Your AI-Generated Resume</h2>
      <pre>{resume}</pre>
      <button onClick={() => navigator.clipboard.writeText(resume)}>Copy Resume</button>
    </div>
  );
}
