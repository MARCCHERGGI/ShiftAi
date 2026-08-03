"use client";

/**
 * Interview — chat-style mock interview. 6 questions, scored 0-10 each,
 * final report card with overall score + tips.
 */

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Mic, RotateCcw, Send } from "lucide-react";

import type {
  AnalyzeResult,
  InterviewRequest,
  InterviewResponse,
  InterviewTurn,
  Profile,
} from "@/src/lib/agents/types";
import { loadAnalysis, loadProfile } from "@/src/lib/store";
import { trackEvent } from "@/src/lib/track";

import NavBar from "@/src/components/ios/NavBar";
import Card from "@/src/components/ios/Card";
import PillButton from "@/src/components/ios/PillButton";
import TextField from "@/src/components/ios/TextField";
import ScoreRing from "@/src/components/ios/ScoreRing";

const TOTAL_QUESTIONS = 6;

type Phase = "idle" | "live" | "done";

export default function InterviewPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResult | null>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [history, setHistory] = useState<InterviewTurn[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState("");
  const [summary, setSummary] = useState<{
    overallScore: number;
    verdict: string;
    tips: string[];
  } | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setProfile(loadProfile());
    setAnalysis(loadAnalysis());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, question, summary, sending]);

  const callApi = async (req: InterviewRequest): Promise<InterviewResponse> => {
    const res = await fetch("/api/agents/interview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(req),
    });
    const j = (await res.json()) as InterviewResponse;
    if (!res.ok || !j.ok) throw new Error(j.error ?? "The coach dropped the call — try again.");
    return j;
  };

  const start = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    setHistory([]);
    setSummary(null);
    setQuestion(null);
    trackEvent("interview_start", { venue: analysis?.venue?.name ?? null });
    try {
      const j = await callApi({
        profile,
        analysis,
        history: [],
        pendingQuestion: null,
        answer: null,
      });
      setQuestion(j.question ?? null);
      setPhase("live");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't start — try again.");
    } finally {
      setSending(false);
    }
  };

  const send = async () => {
    const text = answer.trim();
    if (!text || !question || sending) return;
    setSending(true);
    setError(null);
    try {
      const j = await callApi({
        profile,
        analysis,
        history,
        pendingQuestion: question,
        answer: text,
      });
      const scored = j.scored;
      if (scored) {
        setHistory((prev) => [
          ...prev,
          { question, answer: text, score: scored.score, feedback: scored.feedback },
        ]);
      }
      setAnswer("");
      if (j.done && j.summary) {
        setSummary(j.summary);
        setQuestion(null);
        setPhase("done");
        trackEvent("interview_complete", {
          score: j.summary.overallScore,
          venue: analysis?.venue?.name ?? null,
        });
      } else {
        setQuestion(j.question ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "That one got lost — try again.");
    } finally {
      setSending(false);
    }
  };

  const venueLabel = analysis?.venue?.name ?? null;

  return (
    <main>
      <NavBar title="Interview" large />

      {phase !== "idle" ? <ProgressDots completed={history.length} /> : null}

      {phase === "idle" ? (
        <section style={{ padding: "8px 16px 0" }}>
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <Mic size={20} strokeWidth={2} color="#007AFF" />
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>Mock interview, 6 questions.</h3>
            </div>
            <p
              style={{
                fontSize: 15,
                lineHeight: 1.45,
                margin: "0 0 14px",
                color: "var(--sys-gray, #8E8E93)",
              }}
            >
              {venueLabel
                ? `The coach interviews you for ${venueLabel} — real questions about their menu, their room, their program. Every answer scored 0-10 with honest feedback.`
                : "Classic NYC bartender interview questions, scored 0-10 with honest feedback. Run a prep on the Prep tab first and the questions get venue-specific."}
            </p>
            <PillButton onPress={() => void start()} variant="filled" full loading={sending} disabled={sending}>
              Start the interview
            </PillButton>
            {error ? (
              <p style={{ fontSize: 14, color: "#FF3B30", margin: "10px 0 0" }}>{error}</p>
            ) : null}
          </Card>
        </section>
      ) : (
        <>
          <section style={{ padding: "4px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {history.map((turn, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <CoachBubble text={turn.question} />
                <UserBubble text={turn.answer} />
                <ScorePill score={turn.score} feedback={turn.feedback} />
              </div>
            ))}

            {question ? <CoachBubble text={question} /> : null}

            {sending && phase === "live" ? (
              <p style={{ fontSize: 13, color: "var(--sys-gray, #8E8E93)", margin: "0 4px" }}>
                Coach is thinking…
              </p>
            ) : null}

            {error && phase === "live" ? (
              <p style={{ fontSize: 14, color: "#FF3B30", margin: "0 4px" }}>{error}</p>
            ) : null}
          </section>

          {phase === "done" && summary ? (
            <FinalReport summary={summary} onRestart={() => void start()} restarting={sending} />
          ) : null}

          {phase === "live" && question ? (
            <section style={{ padding: "14px 16px 0" }}>
              <TextField
                value={answer}
                onChange={setAnswer}
                placeholder="Answer like you're standing at the bar…"
                multiline
              />
              <div style={{ marginTop: 10 }}>
                <PillButton
                  onPress={() => void send()}
                  variant="filled"
                  full
                  disabled={sending || !answer.trim()}
                  loading={sending}
                >
                  <Send size={15} strokeWidth={2.2} />
                  Send answer
                </PillButton>
              </div>
            </section>
          ) : null}
        </>
      )}

      <div ref={bottomRef} />
    </main>
  );
}

/* ── chat pieces ─────────────────────────────────── */

const bubbleBase: CSSProperties = {
  maxWidth: "82%",
  padding: "10px 14px",
  borderRadius: 18,
  fontSize: 17, // iOS Messages body
  lineHeight: 1.4,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

function CoachBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div
        style={{
          ...bubbleBase,
          background: "#E9E9EB",
          color: "#111",
          borderBottomLeftRadius: 6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div
        style={{
          ...bubbleBase,
          background: "#007AFF",
          color: "#FFFFFF",
          borderBottomRightRadius: 6,
        }}
      >
        {text}
      </div>
    </div>
  );
}

function ScorePill({ score, feedback }: { score: number; feedback: string }) {
  const color = score >= 8 ? "#248A3D" : score >= 5 ? "#B8860B" : "#FF3B30";
  const bg =
    score >= 8 ? "rgba(52,199,89,0.14)" : score >= 5 ? "rgba(255,204,0,0.18)" : "rgba(255,59,48,0.12)";
  return (
    <div style={{ display: "flex", justifyContent: "flex-end" }}>
      <div style={{ maxWidth: "82%", textAlign: "right" }}>
        <span
          style={{
            display: "inline-block",
            fontSize: 12,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 999,
            background: bg,
            color,
          }}
        >
          {score}/10
        </span>
        <p
          style={{
            fontSize: 13,
            lineHeight: 1.4,
            margin: "5px 0 0",
            color: "var(--sys-gray, #8E8E93)",
            textAlign: "left",
          }}
        >
          {feedback}
        </p>
      </div>
    </div>
  );
}

function ProgressDots({ completed }: { completed: number }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        gap: 8,
        padding: "4px 0 14px",
      }}
      aria-label={`${completed} of ${TOTAL_QUESTIONS} questions answered`}
    >
      {Array.from({ length: TOTAL_QUESTIONS }, (_, i) => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 999,
            background: i < completed ? "#007AFF" : "#D1D1D6",
            transition: "background 200ms ease",
          }}
        />
      ))}
    </div>
  );
}

/* ── final report ────────────────────────────────── */

function FinalReport({
  summary,
  onRestart,
  restarting,
}: {
  summary: { overallScore: number; verdict: string; tips: string[] };
  onRestart: () => void;
  restarting: boolean;
}) {
  // Engine scores answers 0-10; ScoreRing renders 0-100.
  const ringScore =
    summary.overallScore <= 10
      ? Math.round(summary.overallScore * 10)
      : Math.round(summary.overallScore);

  return (
    <section style={{ padding: "35px 16px 0" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ScoreRing score={ringScore} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#007AFF",
              }}
            >
              Final report
            </span>
            <p style={{ fontSize: 15, lineHeight: 1.45, margin: "4px 0 0", fontWeight: 500 }}>
              {summary.verdict}
            </p>
          </div>
        </div>

        {summary.tips.length > 0 ? (
          <>
            <h4
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--sys-gray, #8E8E93)",
                margin: "16px 0 0",
              }}
            >
              Sharpen these
            </h4>
            <ul style={{ fontSize: 15, lineHeight: 1.5, margin: "6px 0 0", paddingLeft: 22 }}>
              {summary.tips.map((tip, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {tip}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <div style={{ marginTop: 16 }}>
          <PillButton onPress={onRestart} variant="tinted" full loading={restarting} disabled={restarting}>
            <RotateCcw size={15} strokeWidth={2.2} />
            Run again
          </PillButton>
        </div>
      </Card>
    </section>
  );
}
