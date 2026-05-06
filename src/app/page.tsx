"use client";

import { useEffect, useRef, useState } from "react";
import {
  appendMessage,
  getProfile,
  getThread,
  saveProfile,
  saveThread,
  type Message,
  type MessageInput,
  type Profile,
} from "@/src/lib/chat-store";
import { trackEvent } from "@/src/lib/track";

type Mode = "free" | "resume_collect";
type ResumeField = "fullName" | "email" | "phone" | "position" | "summary" | "skills" | "experience";

const RESUME_STEPS: { key: ResumeField; q: string }[] = [
  { key: "fullName",   q: "Full name?" },
  { key: "email",      q: "Email?" },
  { key: "phone",      q: "Phone?" },
  { key: "position",   q: "Target role?" },
  { key: "summary",    q: "One sentence — who are you behind the bar?" },
  { key: "skills",     q: "Top skills? (mixology, POS, languages, certs)" },
  { key: "experience", q: "Most recent gig — title, place, what you did?" },
];

const ACTION_RE = /\[ACTION:[a-z]+:[^\]]+\]/g;

export default function Page() {
  const [thread, setThread] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [hydrated, setHydrated] = useState(false);

  const [mode, setMode] = useState<Mode>("free");
  const [resStep, setResStep] = useState(0);
  const [resData, setResData] = useState<Record<ResumeField, string>>({
    fullName: "", email: "", phone: "", position: "", summary: "", skills: "", experience: "",
  });

  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setThread(getThread());
    setProfile(getProfile());
    setHydrated(true);
  }, []);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const doScroll = () => { el.scrollTop = el.scrollHeight; };
    doScroll();
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
  }, [thread, busy]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  const push = (m: MessageInput) => {
    const created = appendMessage(m);
    setThread((p) => [...p, created]);
    return created;
  };

  const reset = () => {
    saveThread([]);
    setThread([]);
    setMode("free");
    setResStep(0);
  };

  /* ── Chat ─────────────────────────────────────────── */
  const sendFree = async (text: string) => {
    push({ role: "user", content: text });
    setBusy(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const messages = [...getThread(), { role: "user" as const, content: text }]
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-14);

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages, profile }),
        signal: ac.signal,
      });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({} as { retryAfter?: number }));
        push({ role: "assistant", content: `Slow down — try again in ${j.retryAfter ?? 30}s.` });
        return;
      }
      if (!res.ok) {
        push({ role: "assistant", content: "That one didn't land. Try again." });
        return;
      }
      const json = await res.json();
      const reply = (json.reply || "Sorry — couldn't generate a reply.").replace(ACTION_RE, "").trim();
      push({ role: "assistant", content: reply });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      push({ role: "assistant", content: "Network error. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  /* ── Resume ──────────────────────────────────────── */
  const startResume = () => {
    setMode("resume_collect");
    setResStep(0);
    setResData({
      fullName: profile.name || "",
      email: "", phone: "",
      position: profile.role || "Bartender",
      summary: "", skills: "", experience: "",
    });
    push({
      role: "assistant",
      content: `Let's build your resume. Seven quick questions.\n\n${RESUME_STEPS[0].q}`,
    });
    composerRef.current?.focus();
  };

  const submitResumeAnswer = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    push({ role: "user", content: trimmed });
    const cur = RESUME_STEPS[resStep];
    const nextData = { ...resData, [cur.key]: trimmed };
    setResData(nextData);
    const nextStep = resStep + 1;
    if (nextStep < RESUME_STEPS.length) {
      setResStep(nextStep);
      push({ role: "assistant", content: RESUME_STEPS[nextStep].q });
      return;
    }
    setBusy(true);
    push({ role: "assistant", content: "Building your PDF…" });
    try {
      const res = await fetch("/api/generate-resume", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(nextData),
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nextData.fullName || "resume"}_Jigger.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      saveProfile({ ...profile, name: nextData.fullName, role: nextData.position });
      setProfile({ ...profile, name: nextData.fullName, role: nextData.position });
      push({ role: "tool", kind: "resume", data: { name: nextData.fullName, bytes: blob.size } });
      push({ role: "assistant", content: "Shipped. Tweak it and send it." });
      trackEvent("resume_complete", { fields: Object.keys(nextData).length });
    } catch {
      push({ role: "assistant", content: "PDF build failed. Try again." });
    } finally {
      setMode("free");
      setBusy(false);
    }
  };

  /* ── Send ─────────────────────────────────────────── */
  const onSend = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    if (composerRef.current) composerRef.current.style.height = "auto";

    if (mode === "resume_collect") {
      void submitResumeAnswer(text);
      return;
    }
    void sendFree(text);
  };

  const exitResume = () => {
    push({ role: "assistant", content: "Paused. Ask me anything else." });
    setMode("free");
    setResStep(0);
  };

  const empty = hydrated && thread.length === 0;

  return (
    <>
      <Splash />
      <div className="app-shell">
        <header className="app-shell__header app-bar">
          <div className="app-bar__row">
            <div className="flex items-center gap-2">
              <span className="app-bar__brand" aria-label="Jigger">
                <Mark />
                {mode === "resume_collect" ? "Resume" : "Jigger"}
              </span>
              {mode === "resume_collect" && (
                <button onClick={exitResume} className="icon-btn" aria-label="Exit resume" style={{ width: 30, height: 30, color: "var(--ink-3)" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            {thread.length > 0 && mode === "free" && (
              <button onClick={reset} className="icon-btn" aria-label="New chat">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
          </div>
        </header>

        <main ref={mainRef} className="app-shell__main">
          <div className="px-4 max-w-[720px] mx-auto pt-2 pb-4">
            {empty && <EmptyIntro onChat={() => composerRef.current?.focus()} onResume={startResume} />}

            <div className="flex flex-col gap-2.5 mt-2">
              {thread.map((m) => <Bubble key={m.id} m={m} />)}
              {busy && <Typing />}
            </div>
          </div>
        </main>

        {/* Floating "Build resume" CTA when there's a thread and we're in free mode */}
        {!empty && mode === "free" && !busy && (
          <div className="px-4 max-w-[720px] mx-auto pb-1" style={{ pointerEvents: "auto" }}>
            <button onClick={startResume} className="action-chip action-chip--primary" style={{ width: "100%", justifyContent: "center" }}>
              Build my resume →
            </button>
          </div>
        )}

        <footer className="app-shell__footer" data-interactive>
          <div className="composer">
            <textarea
              ref={composerRef}
              className="composer__input"
              rows={1}
              placeholder={
                mode === "resume_collect"
                  ? `${RESUME_STEPS[resStep]?.q || "…"}  · ${resStep + 1} of ${RESUME_STEPS.length}`
                  : "Ask anything — bar jobs, prep, the industry"
              }
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
              }}
              disabled={busy}
              enterKeyHint="send"
              autoCorrect="on"
              autoCapitalize="sentences"
            />
            <button onClick={onSend} disabled={!input.trim() || busy} className="composer__send" aria-label="Send">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M3 12 21 4l-7 18-3-7z" />
              </svg>
            </button>
          </div>
        </footer>
      </div>
    </>
  );
}

/* ── Empty intro — two clear paths ──────────────────── */
function EmptyIntro({ onChat, onResume }: { onChat: () => void; onResume: () => void }) {
  return (
    <section className="hero-frame fade-in">
      <p className="label" aria-hidden>AI for bartender jobs · NYC</p>

      <h1 className="editorial mt-3">
        <span className="serif-italic">Talk</span> to me.
        <br />
        Or get a resume.
      </h1>

      <p className="muted mt-5 max-w-[42ch]" style={{ fontSize: 17, lineHeight: 1.5 }}>
        Two things. Ask anything about bar jobs in NYC, or build a resume in seven questions.
      </p>

      <div className="measure-rule">Pick one</div>

      <div className="flex flex-wrap gap-2.5 mt-5">
        <button onClick={onChat} className="action-chip action-chip--primary">
          Just chat
        </button>
        <button onClick={onResume} className="action-chip">
          Build my resume
        </button>
      </div>
    </section>
  );
}

/* ── Splash ────────────────────────────────────────── */
function Splash() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("jigger:splash:seen")) return;
    setShow(true);
    sessionStorage.setItem("jigger:splash:seen", "1");
    const t = setTimeout(() => setShow(false), 1500);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return (
    <div className="splash" aria-hidden onClick={() => setShow(false)}>
      <div className="splash__mark">
        <svg viewBox="0 0 24 24" width="80" height="80" fill="none" stroke="currentColor" strokeWidth="0.8" strokeLinejoin="round" strokeLinecap="round">
          <path d="M6 4 H18 L14 12 V12.5 L18 20 H6 L10 12.5 V12 Z" />
        </svg>
        <div className="splash__pour">
          <svg viewBox="0 0 24 24" width="80" height="80" fill="currentColor" stroke="none">
            <path d="M6 4 H18 L14 12 V12.5 L18 20 H6 L10 12.5 V12 Z" />
          </svg>
        </div>
      </div>
      <p className="splash__word">Jigger</p>
    </div>
  );
}

/* ── Bubble — only user / assistant / resume tool kind ── */
function Bubble({ m }: { m: Message }) {
  if (m.role === "assistant") return <div className="bubble bubble--ai">{m.content}</div>;
  if (m.role === "user")      return <div className="bubble bubble--you">{m.content}</div>;

  if (m.kind === "resume") {
    return (
      <div className="bubble bubble--rich">
        <div className="lg flex items-center gap-3" style={{ padding: 16 }}>
          <span style={{
            width: 40, height: 40, borderRadius: 12,
            background: "var(--ink)", color: "#FFFFFF",
            display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 4px 10px -3px rgba(10,10,10,0.30), inset 0 1px 0 rgba(255,255,255,0.12)",
          }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
              <path d="M14 3v5h5" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <p className="body" style={{ fontWeight: 600 }}>Resume · PDF</p>
            <p className="meta">{m.data.name} · {(m.data.bytes / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      </div>
    );
  }
  return null;
}

function Typing() {
  return (
    <div className="bubble bubble--ai typing" style={{ padding: "12px 16px" }} role="status" aria-live="polite" aria-label="Jigger is thinking">
      <span className="typing__pour" aria-hidden>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
          <path d="M6 4 H18 L14 12 V12.5 L18 20 H6 L10 12.5 V12 Z" />
        </svg>
        <span className="typing__fill" />
      </span>
      <span className="typing__label">Pouring</span>
    </div>
  );
}

function Mark() {
  return (
    <span style={{
      width: 28, height: 28, borderRadius: 9,
      background: "var(--ink)", color: "#FFFFFF",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 4px 10px -3px rgba(10,10,10,0.30), inset 0 1px 0 rgba(255,255,255,0.12)",
    }} aria-hidden>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M6 4 H18 L14 12 V12.5 L18 20 H6 L10 12.5 V12 Z" />
        <line x1="7.4" y1="7" x2="16.6" y2="7" strokeWidth="0.9" opacity="0.45" />
        <line x1="8.6" y1="9.4" x2="15.4" y2="9.4" strokeWidth="0.9" opacity="0.32" />
      </svg>
    </span>
  );
}
