"use client";

/**
 * Resume — generate a venue-tailored bartender resume from the profile +
 * last analysis, preview it as an elegant white card, download as PDF.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { Download, FileText, Sparkles, UserRound } from "lucide-react";

import type {
  AnalyzeResult,
  Profile,
  ResumeDoc,
  ResumeResponse,
} from "@/src/lib/agents/types";
import { hasUsableProfile, loadAnalysis, loadProfile } from "@/src/lib/store";
import { trackEvent } from "@/src/lib/track";

import NavBar from "@/src/components/ios/NavBar";
import Card from "@/src/components/ios/Card";
import PillButton from "@/src/components/ios/PillButton";

export default function ResumePage() {
  const router = useRouter();

  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);

  const [resume, setResume] = useState<ResumeDoc | null>(null);
  const [generating, setGenerating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setAnalysis(loadAnalysis());
    setReady(true);
  }, []);

  const generate = async () => {
    if (!hasUsableProfile(profile) || generating) return;
    setGenerating(true);
    setError(null);
    trackEvent("resume_generate", { tailored: !!analysis });
    try {
      const res = await fetch("/api/agents/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, analysis }),
      });
      const j = (await res.json()) as ResumeResponse;
      if (!res.ok || !j.ok || !j.resume) {
        throw new Error(j.error ?? "Resume generation failed — try again.");
      }
      setResume(j.resume);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Resume generation failed — try again.");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPdf = async () => {
    if (!hasUsableProfile(profile) || !resume || downloading) return;
    setDownloading(true);
    setError(null);
    trackEvent("resume_pdf", { tailored: !!resume.tailoredTo });
    try {
      const res = await fetch("/api/agents/resume", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile, analysis, resume, format: "pdf" }),
      });
      if (!res.ok) throw new Error(`PDF failed (${res.status}) — try again.`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ShiftAI-Resume.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed — try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main>
      <NavBar title="Resume" large />

      {!ready ? null : !hasUsableProfile(profile) ? (
        <section style={{ padding: "8px 16px 0" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <UserRound size={20} strokeWidth={2} color="#007AFF" />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>
                First, tell us who&rsquo;s pouring.
              </h3>
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.45, margin: "0 0 14px", color: "var(--sys-gray, #8E8E93)" }}>
              Your resume builds from your profile — name, experience, skills, certs. Takes
              two minutes to fill in.
            </p>
            <PillButton onPress={() => router.push("/profile")} variant="filled" full>
              Fill in my profile
            </PillButton>
          </Card>
        </section>
      ) : (
        <>
          <section style={{ padding: "0 16px" }}>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.4,
                color: "var(--sys-gray, #8E8E93)",
                margin: "4px 4px 14px",
              }}
            >
              {analysis?.venue
                ? `Tailored to ${analysis.venue.name} from your last prep.`
                : "Run a prep on the Prep tab first and the resume tailors itself to the venue."}
            </p>
            <PillButton onPress={() => void generate()} variant="filled" full loading={generating} disabled={generating}>
              <Sparkles size={16} strokeWidth={2.2} />
              {resume ? "Regenerate" : "Generate my resume"}
            </PillButton>
          </section>

          {error ? (
            <p style={{ fontSize: 14, color: "#FF3B30", margin: "12px 20px 0" }}>{error}</p>
          ) : null}

          {resume ? (
            <>
              <section style={{ padding: "35px 16px 0" }}>
                <ResumePreview resume={resume} profile={profile} />
              </section>
              <section style={{ padding: "16px 16px 0" }}>
                <PillButton
                  onPress={() => void downloadPdf()}
                  variant="tinted"
                  full
                  loading={downloading}
                  disabled={downloading}
                >
                  <Download size={16} strokeWidth={2.2} />
                  Download PDF
                </PillButton>
              </section>
            </>
          ) : !generating ? (
            <div className="empty">
              <FileText size={56} strokeWidth={1.5} className="empty__icon" />
              <h3 className="empty__title">No resume yet</h3>
              <p className="empty__desc">
                Generate builds a one-page, ATS-friendly resume from your profile —
                tailored to the venue when you&rsquo;ve run a prep.
              </p>
            </div>
          ) : null}
        </>
      )}
    </main>
  );
}

/* ── the white card resume ───────────────────────── */

function ResumePreview({ resume, profile }: { resume: ResumeDoc; profile: Profile }) {
  const sectionTitle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "#8E8E93",
    margin: "18px 0 0",
    paddingBottom: 4,
    borderBottom: "1px solid #E5E5EA",
  };

  const contact = [profile.email, profile.phone, profile.neighborhood]
    .map((c) => c.trim())
    .filter(Boolean)
    .join("  ·  ");

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 20,
        padding: "28px 24px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)",
      }}
    >
      {resume.tailoredTo ? (
        <span
          style={{
            display: "inline-block",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "#007AFF",
            background: "rgba(0,122,255,0.1)",
            borderRadius: 999,
            padding: "4px 10px",
            marginBottom: 12,
          }}
        >
          Tailored to {resume.tailoredTo}
        </span>
      ) : null}

      <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#111" }}>
        {profile.name}
      </h2>
      <p style={{ fontSize: 14, fontWeight: 600, margin: "2px 0 0", color: "#007AFF" }}>
        {resume.headline}
      </p>
      {contact ? (
        <p style={{ fontSize: 12, margin: "6px 0 0", color: "#8E8E93" }}>{contact}</p>
      ) : null}

      <p style={{ fontSize: 14, lineHeight: 1.5, margin: "14px 0 0", color: "#333" }}>
        {resume.summary}
      </p>

      {resume.experience.length > 0 ? (
        <>
          <h3 style={sectionTitle}>Experience</h3>
          {resume.experience.map((exp, i) => (
            <div key={i} style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#111" }}>{exp.place}</span>
                <span style={{ fontSize: 12, color: "#8E8E93", whiteSpace: "nowrap" }}>{exp.time}</span>
              </div>
              <p style={{ fontSize: 13, fontWeight: 600, margin: "1px 0 4px", color: "#555" }}>
                {exp.role}
              </p>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {exp.bullets.map((b, j) => (
                  <li key={j} style={{ fontSize: 13, lineHeight: 1.5, color: "#333", marginBottom: 3 }}>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </>
      ) : null}

      {resume.skills.length > 0 ? (
        <>
          <h3 style={sectionTitle}>Skills</h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 0", color: "#333" }}>
            {resume.skills.join("  ·  ")}
          </p>
        </>
      ) : null}

      {resume.certs.length > 0 ? (
        <>
          <h3 style={sectionTitle}>Certifications</h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 0", color: "#333" }}>
            {resume.certs.join("  ·  ")}
          </p>
        </>
      ) : null}

      {resume.extras.length > 0 ? (
        <>
          <h3 style={sectionTitle}>Extras</h3>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 0", color: "#333" }}>
            {resume.extras.join("  ·  ")}
          </p>
        </>
      ) : null}
    </div>
  );
}
