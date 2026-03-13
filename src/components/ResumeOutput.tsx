// src/app/components/ResumeOutput.tsx
"use client";

type ResumeOutputProps = {
  resume: string;
  pdfBase64?: string;
};

export default function ResumeOutput({ resume, pdfBase64 }: ResumeOutputProps) {
  const handleDownloadPdf = () => {
    if (!pdfBase64) return;

    // Decode Base64 to binary
    const byteChars = atob(pdfBase64);
    const byteNumbers = new Array(byteChars.length).fill(0).map((_, i) =>
      byteChars.charCodeAt(i)
    );
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    // Trigger browser download
    const a = document.createElement("a");
    a.href = url;
    a.download = "resume.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(resume);
  };

  return (
    <div className="resume-output max-w-2xl mx-auto mt-8 p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-2xl font-semibold mb-4">Your AI-Generated Résumé</h2>

      <div className="whitespace-pre-wrap bg-gray-50 dark:bg-gray-700 p-4 rounded mb-6 overflow-auto">
        <pre className="text-sm">{resume}</pre>
      </div>

      <div className="flex space-x-4">
        <button
          onClick={handleCopyText}
          className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 transition"
        >
          Copy Résumé Text
        </button>

        <button
          onClick={handleDownloadPdf}
          disabled={!pdfBase64}
          className="px-4 py-2 bg-green-600 text-white rounded-md font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Download PDF
        </button>
      </div>
    </div>
  );
}
