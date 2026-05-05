"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  getResearch,
  saveResearch,
  saveInterviewResults,
} from "@/src/lib/research-store";
import { trackEvent } from "@/src/lib/track";
import { computeVerdict } from "@/src/lib/verdict";
import type {
  ResearchPackage,
  AnswerEvaluation,
  InterviewQuestion,
} from "@/src/lib/types";
import { getSavedJobs, saveJob, unsaveJob, isJobSaved } from "@/src/lib/saved-jobs";
import ProfileSheet from "@/src/components/ProfileSheet";
import ListingsDrawer from "@/src/components/ListingsDrawer";
import HamburgerMenu from "@/src/components/HamburgerMenu";
import BackendNetworkSheet from "@/src/components/BackendNetworkSheet";

type ActionType = "analyze" | "interview" | "resume" | "profile" | "hunt";
type ParsedReply = { text: string; actions: { type: ActionType; label: string }[] };

const ACTION_RE = /\[ACTION:(analyze|interview|resume|profile|hunt):([^\]]+)\]/g;

function parseReply(raw: string): ParsedReply {
  const actions: { type: ActionType; label: string }[] = [];
  const text = raw.replace(ACTION_RE, (_, type, label) => {
    actions.push({ type: type as ActionType, label: label.trim() });
    return "";
  }).trim();
  return { text, actions };
}

const fallbackQuestions: InterviewQuestion[] = [
  { id: 1, question: "Tell me about yourself and your bartending experience.", category: "Behavioral", difficulty: "Easy", tip: "" },
  { id: 2, question: "How do you handle a difficult or intoxicated customer?", category: "Situational", difficulty: "Medium", tip: "" },
  { id: 3, question: "What's your approach to making craft cocktails under pressure?", category: "Technical", difficulty: "Medium", tip: "" },
  { id: 4, question: "Describe a time you worked effectively as part of a bar team.", category: "Behavioral", difficulty: "Easy", tip: "" },
  { id: 5, question: "What do you know about responsible alcohol service?", category: "Technical", difficulty: "Medium", tip: "" },
];

type Mode = "free" | "interview" | "resume_collect";
type ResumeField = "fullName" | "email" | "phone" | "position" | "summary" | "skills" | "experience";
const RESUME_STEPS: { key: ResumeField; q: string }[] = [
  { key: "fullName",   q: "Full name?" },
  { key: "email",      q: "Email?" },
  { key: "phone",      q: "Phone?" },
  { key: "position",   q: "Target role?" },
  { key: "summary",    q: "One sentence — who are you as a bartender?" },
  { key: "skills",     q: "Top skills? (mixology, POS, languages, certs)" },
  { key: "experience", q: "Most recent gig — title, place, what you did?" },
];

export default function Page() {
  const [thread, setThread] = useState<Message[]>([]);
  const [input, setInput]   = useState("");
  const [busy, setBusy]     = useState(false);
  const [profile, setProfile] = useState<Profile>({});
  const [profileOpen, setProfileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [listingsOpen, setListingsOpen] = useState(false);
  const [backendOpen, setBackendOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [lastActions, setLastActions] = useState<{ type: ActionType; label: string }[]>([]);

  const [mode, setMode] = useState<Mode>("free");
  const [intQs, setIntQs] = useState<InterviewQuestion[]>([]);
  const [intIdx, setIntIdx] = useState(0);
  const [intResults, setIntResults] = useState<{ q: InterviewQuestion; a: string; ev: AnswerEvaluation }[]>([]);

  const [resStep, setResStep] = useState(0);
  const [resData, setResData] = useState<Record<ResumeField, string>>({
    fullName: "", email: "", phone: "", position: "", summary: "", skills: "", experience: "",
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setThread(getThread());
    setProfile(getProfile());
    setHydrated(true);
  }, []);

  // Scroll the thread container to bottom on new bubble — reliable on iOS Safari
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const doScroll = () => { el.scrollTop = el.scrollHeight; };
    doScroll();
    // Double-rAF to catch post-layout height changes (bubble animations, image loads)
    requestAnimationFrame(() => requestAnimationFrame(doScroll));
  }, [thread, busy]);

  // Cancel in-flight requests on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // Global keyboard shortcuts — `/` focuses composer, `Esc` exits flow
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const inField = t?.tagName === "INPUT" || t?.tagName === "TEXTAREA";
      if (e.key === "/" && !inField) {
        e.preventDefault();
        composerRef.current?.focus();
      }
      if (e.key === "Escape" && inField && composerRef.current === t) {
        composerRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const push = (m: MessageInput) => {
    const created = appendMessage(m);
    setThread((p) => [...p, created]);
    return created;
  };

  const reset = () => {
    saveThread([]);
    setThread([]);
    setMode("free");
    setIntIdx(0); setIntQs([]); setIntResults([]);
    setResStep(0);
    setLastActions([]);
  };

  function detectIntent(text: string): "analyze" | "free" {
    const lc = text.toLowerCase();
    // Require at least 2 distinct markers AND sufficient length.
    // Dropped "shift" — it's the app name and triggers false-positives.
    const markers = [
      /\$\d/,           // dollar amount
      /\b\d+\s*(?:\/|per)?\s*(?:hr|hour)\b/, // hourly
      /\btips?\b/,
      /\b(?:bartender|barback|server|host(?:ess)?|sommelier|cicerone)\b/,
      /\b(?:full[-\s]?time|part[-\s]?time|seasonal)\b/,
      /\b(?:craft cocktail|mixolog|pos|spec|menu)\b/,
      /\bexperience\s+(?:required|preferred|a\s+plus)\b/,
    ];
    const hits = markers.reduce((n, re) => n + (re.test(lc) ? 1 : 0), 0);
    const longEnough = text.length > 220;
    if (hits >= 2 && longEnough) return "analyze";
    return "free";
  }

  /* ── Free chat ─────────────────────────────────────── */
  const sendFree = async (text: string) => {
    push({ role: "user", content: text });
    setBusy(true);
    setLastActions([]);
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
        const retry = j.retryAfter ?? 30;
        push({ role: "assistant", content: `Slow down — try again in ${retry}s.` });
        return;
      }
      if (!res.ok) {
        push({ role: "assistant", content: "That one didn't land. Try again." });
        return;
      }
      const json = await res.json();
      const parsed = parseReply(json.reply || "Sorry — couldn't generate a reply.");
      push({ role: "assistant", content: parsed.text });
      setLastActions(parsed.actions);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      push({ role: "assistant", content: "Network error. Try again in a moment." });
    } finally {
      setBusy(false);
    }
  };

  /* ── Analyze a pasted listing ─────────────────────── */
  const sendAnalyze = async (listing: string) => {
    push({ role: "user", content: listing });
    push({ role: "assistant", content: "On it — five agents reading the room. ~30s." });
    setBusy(true);
    setLastActions([]);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const startedAt = Date.now();
    trackEvent("job_analyze_start", { listing_length: listing.length });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ listing }),
        signal: ac.signal,
      });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({} as { retryAfter?: number }));
        push({ role: "assistant", content: `Hit the rate limit — try again in ${j.retryAfter ?? 60}s.` });
        return;
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({} as { error?: string }));
        throw new Error(err.error || "Analysis failed");
      }
      const data: ResearchPackage = await res.json();
      saveResearch(data);

      const v = computeVerdict(data.job);
      push({ role: "tool", kind: "analysis", data });
      push({ role: "assistant", content: `${v.label}. ${v.reason}` });
      // No floating chips — the analysis card already has Prep/Resume buttons
      setLastActions([]);
      trackEvent("job_analyze_success", { elapsed_ms: Date.now() - startedAt });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      push({ role: "assistant", content: `Couldn't analyze — ${err instanceof Error ? err.message : "unknown"}.` });
    } finally {
      setBusy(false);
    }
  };

  /* ── Interview ────────────────────────────────────── */
  const startInterview = () => {
    const r = getResearch();
    const list = (r?.questions && r.questions.length > 0) ? r.questions : fallbackQuestions;
    setIntQs(list); setIntIdx(0); setIntResults([]);
    setMode("interview");
    setLastActions([]);
    push({
      role: "assistant",
      content: `Mock interview — ${list.length} questions. Be specific, I score every answer.\n\n${list[0].question}`,
    });
  };

  const submitInterviewAnswer = async (text: string) => {
    push({ role: "user", content: text });
    setBusy(true);
    const q = intQs[intIdx];
    let ev: AnswerEvaluation;
    try {
      const res = await fetch("/api/interview/evaluate", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: q.question, answer: text,
          jobContext: profile.role || "Bartender",
          venueContext: "Restaurant/bar",
        }),
      });
      if (!res.ok) throw new Error();
      ev = await res.json();
    } catch {
      ev = {
        score: text.length > 50 ? 7 : 5,
        verdict: text.length > 50 ? "Decent answer." : "Needs more detail.",
        strengths: ["Answered the question"],
        improvements: ["Add a specific example"],
        sampleAnswer: "Name a venue + outcome.",
      };
    }

    const newResults = [...intResults, { q, a: text, ev }];
    setIntResults(newResults);
    push({ role: "tool", kind: "score", data: { score: ev.score, verdict: ev.verdict, question: q.question, answer: text } });

    const nextIdx = intIdx + 1;
    if (nextIdx < intQs.length) {
      setIntIdx(nextIdx);
      push({ role: "assistant", content: `${ev.verdict} Fix: ${ev.improvements[0] || "—"}.\n\nNext: ${intQs[nextIdx].question}` });
    } else {
      const avg = Math.round(newResults.reduce((s, r) => s + r.ev.score, 0) / newResults.length * 10);
      saveInterviewResults(newResults.map((r) => ({
        questionId: r.q.id, question: r.q.question, answer: r.a, evaluation: r.ev,
      })));
      push({ role: "assistant", content: `Done. ${avg}/100 across ${newResults.length}.` });
      setLastActions([
        { type: "interview", label: "Try again" },
        { type: "hunt",      label: "Find more jobs" },
      ]);
      setMode("free");
      trackEvent("interview_complete", { total_questions: intQs.length, answered: newResults.length, avg_score: avg / 10 });
    }
    setBusy(false);
  };

  /* ── Resume collect ────────────────────────────────── */
  const startResume = () => {
    setMode("resume_collect");
    setResStep(0);
    setResData({
      fullName: profile.name || "",
      email: "",
      phone: "",
      position: getResearch()?.job?.title || "",
      summary: "",
      skills: "",
      experience: "",
    });
    setLastActions([]);
    const research = getResearch();
    const intro = research?.venue?.name
      ? `Drafting your resume for ${research.venue.name}. Seven quick questions — I already know the venue.`
      : "Drafting your resume. Seven quick questions.";
    push({
      role: "assistant",
      content: `${intro}\n\n${RESUME_STEPS[0].q}`,
    });
  };

  const submitResumeAnswer = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;                         // guard empty/whitespace
    push({ role: "user", content: trimmed });
    const cur = RESUME_STEPS[resStep];
    const nextData = { ...resData, [cur.key]: trimmed };
    setResData(nextData);
    const nextStep = resStep + 1;
    if (nextStep < RESUME_STEPS.length) {
      setResStep(nextStep);
      push({ role: "assistant", content: RESUME_STEPS[nextStep].q });
    } else {
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
        push({ role: "tool", kind: "resume", data: { name: nextData.fullName, bytes: blob.size } });
        push({ role: "assistant", content: "Shipped. Tweak the download and send it." });
        setLastActions([{ type: "interview", label: "Mock interview for this role" }]);
      } catch {
        push({ role: "assistant", content: "PDF build failed. Try again." });
      } finally {
        setMode("free");
        setBusy(false);
      }
    }
  };

  /* ── Action dispatcher ────────────────────────────── */
  const handleAction = (type: ActionType) => {
    if (type === "analyze") {
      push({ role: "assistant", content: "Paste the listing — anything goes." });
      setLastActions([]);
      composerRef.current?.focus();
    } else if (type === "interview") {
      startInterview();
    } else if (type === "resume") {
      startResume();
    } else if (type === "profile") {
      setProfileOpen(true);
    } else if (type === "hunt") {
      // Auto-fire — consistent with other chips that start flows immediately
      const prompt = profile.role && profile.experience
        ? `Help me find a ${profile.role.toLowerCase()} job. I've got ${profile.experience}.`
        : "Help me find a bartender job.";
      void sendFree(prompt);
    }
  };

  const onSend = () => {
    const text = input.trim();
    if (!text || busy) return;

    if (mode === "interview") {
      submitInterviewAnswer(text);
      setInput("");
      resetComposerHeight();
      return;
    }
    if (mode === "resume_collect") {
      submitResumeAnswer(text);
      setInput("");
      resetComposerHeight();
      return;
    }

    const intent = detectIntent(text);
    // Clear AFTER dispatch so retry keeps the text available
    setInput("");
    resetComposerHeight();
    if (intent === "analyze") return void sendAnalyze(text);
    return void sendFree(text);
  };

  const resetComposerHeight = () => {
    if (composerRef.current) composerRef.current.style.height = "auto";
  };

  // Escape hatch from interview/resume flow
  const exitFlow = () => {
    if (mode === "interview") {
      push({ role: "assistant", content: "Paused the interview. Come back any time." });
    } else if (mode === "resume_collect") {
      push({ role: "assistant", content: "Resume drafting paused. Ask me anything else." });
    }
    setMode("free");
    setIntIdx(0);
    setIntQs([]);
    setIntResults([]);
    setResStep(0);
    setLastActions([]);
  };

  // Tap anywhere in thread → blur composer (iOS dismiss-keyboard convention)
  const handleThreadTap = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't dismiss if the tap was on a button/input/interactive element
    if (target.closest("button, a, input, textarea, [data-interactive]")) return;
    composerRef.current?.blur();
  };

  // When composer gets focus, scroll thread to bottom so user sees their latest
  const handleComposerFocus = () => {
    requestAnimationFrame(() => {
      const el = mainRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const initial = (profile.name || "Y").charAt(0).toUpperCase();
  const empty = hydrated && thread.length === 0;

  return (
    <>
    <Splash />
    <div className="app-shell">
      {/* App bar */}
      <header className="app-shell__header app-bar">
        <div className="app-bar__row">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMenuOpen(true)}
              className="icon-btn"
              aria-label="Menu"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            {/* Brand is visual only — not a duplicate tap target */}
            <span className="app-bar__brand" aria-label="Jigger">
              <Mark />
              {mode === "interview"      ? "Interview" :
               mode === "resume_collect" ? "Resume"    :
                                           "Jigger"}
            </span>
            {/* Cancel chip when in a flow — lets user escape */}
            {mode !== "free" && (
              <button
                onClick={exitFlow}
                className="icon-btn"
                aria-label="Exit flow"
                style={{ width: 30, height: 30, color: "var(--ink-3)" }}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <button
            onClick={() => setProfileOpen(true)}
            className="avatar"
            aria-label="Profile"
            style={profile.photo ? { background: `url(${profile.photo}) center / cover`, color: "transparent" } : undefined}
          >
            {!profile.photo && initial}
          </button>
        </div>
      </header>

      {/* Thread — scrolls independently; composer stays above keyboard */}
      <main ref={mainRef} className="app-shell__main" onClick={handleThreadTap}>
        <div className="px-4 max-w-[720px] mx-auto pt-2 pb-4">
          {empty && <EmptyIntro onAction={handleAction} profile={profile} />}

          <div className="flex flex-col gap-2.5 mt-2">
            {thread.map((m) => <Bubble key={m.id} m={m} onAction={handleAction} />)}
            {busy && <Typing />}
            {!busy && lastActions.length > 0 && mode === "free" && (
              <div className="flex flex-wrap gap-2 mt-1 fade-in" style={{ paddingLeft: 2 }}>
                {lastActions.map((a, i) => (
                  <button
                    key={i}
                    onClick={() => handleAction(a.type)}
                    className={`action-chip ${i === 0 ? "action-chip--primary" : ""}`}
                  >
                    <ActionIcon type={a.type} />
                    {a.label}
                  </button>
                ))}
              </div>
            )}
            <div ref={scrollRef} />
          </div>
        </div>
      </main>

      {/* Composer — flex-shrink: 0 so it never goes under the keyboard */}
      <footer className="app-shell__footer" data-interactive>
        <div className="composer">
          <textarea
            ref={composerRef}
            className="composer__input"
            rows={1}
            placeholder={
              mode === "interview"      ? `Your answer · ${intIdx + 1} of ${intQs.length}` :
              mode === "resume_collect" ? `${RESUME_STEPS[resStep]?.q || "…"}  · ${resStep + 1} of ${RESUME_STEPS.length}` :
                                          "Paste a Manhattan listing — or ask anything"
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
            onFocus={handleComposerFocus}
            disabled={busy}
            enterKeyHint="send"
            autoCorrect="on"
            autoCapitalize="sentences"
          />
          <button
            onClick={onSend}
            disabled={!input.trim() || busy}
            className="composer__send"
            aria-label="Send"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M3 12 21 4l-7 18-3-7z" />
            </svg>
          </button>
        </div>
      </footer>

      <ProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onProfileChange={setProfile}
        onThreadCleared={reset}
      />

      <ListingsDrawer
        open={listingsOpen}
        onClose={() => setListingsOpen(false)}
        onPick={(l) => {
          setListingsOpen(false);
          // Build a listing payload the analyzer can digest and fire it into chat
          const payload = [
            l.title,
            l.neighborhood ? `(${l.neighborhood})` : "",
            "",
            l.snippet || "",
            "",
            `Source: ${l.url}`,
          ].filter(Boolean).join("\n");
          // Delay slightly so drawer animation completes before bubbles pop
          setTimeout(() => void sendAnalyze(payload), 220);
        }}
      />

      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onPickListings={() => { setMenuOpen(false); setListingsOpen(true); }}
        onPickBackend={() => { setMenuOpen(false); setBackendOpen(true); }}
      />

      <BackendNetworkSheet
        open={backendOpen}
        onClose={() => setBackendOpen(false)}
        phase={busy ? "analyzing" : (thread.some((m) => m.role === "tool" && m.kind === "analysis") ? "done" : "idle")}
      />
    </div>
    </>
  );
}

/* ── Splash — first-load pour animation, gated to once-per-session ── */

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

/* ── Empty intro ───────────────────────────────────── */

function EmptyIntro({
  onAction,
  profile,
}: {
  onAction: (t: ActionType) => void;
  profile: Profile;
}) {
  const name = profile.name;
  const role = profile.role;
  const hasProfile = Boolean(name && role);

  // Time-aware greeting — gives returning users a sense the app knows them
  const [savedCount, setSavedCount] = useState(0);
  useEffect(() => { setSavedCount(getSavedJobs().length); }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return "Good morning";
    if (h >= 12 && h < 17) return "Afternoon";
    if (h >= 17 && h < 22) return "Evening";
    return "Late night";
  }, []);

  // First-time users: lean onboarding state
  if (!hasProfile) {
    return (
      <section className="hero-frame fade-in">
        <p className="label" aria-hidden>No. 01 · NYC · AI for bartenders</p>

        <h1 className="editorial mt-3">
          <span className="serif-italic">AI</span> for
          <br />
          bartender jobs.
        </h1>

        <p className="muted mt-5 max-w-[44ch]" style={{ fontSize: 17, lineHeight: 1.5 }}>
          Live Manhattan listings. Venue research. Resume tailored to the bar.
          Interview prep that knows the room. Server, host, barback covered too.
        </p>

        <div className="measure-rule">Pick your role · 30 seconds</div>

        <div className="onboarding-grid mt-5">
          <OnboardChip label="Bartender"        onClick={() => { saveProfile({ ...profile, role: "Bartender" }); onAction("hunt"); }} />
          <OnboardChip label="Barback"          onClick={() => { saveProfile({ ...profile, role: "Barback" }); onAction("hunt"); }} />
          <OnboardChip label="Server"           onClick={() => { saveProfile({ ...profile, role: "Server" }); onAction("hunt"); }} />
          <OnboardChip label="Host / hostess"   onClick={() => { saveProfile({ ...profile, role: "Host" }); onAction("hunt"); }} />
          <OnboardChip label="Runner / busser"  onClick={() => { saveProfile({ ...profile, role: "Runner" }); onAction("hunt"); }} />
          <OnboardChip label="Just exploring"   onClick={() => onAction("analyze")} ghost />
        </div>

        <div className="kbd-hint mt-7">
          <kbd>/</kbd> to start typing · <kbd>Esc</kbd> to dismiss
        </div>
      </section>
    );
  }

  // Returning users: smart briefing
  return (
    <section className="hero-frame fade-in">
      <p className="label" aria-hidden>No. 02 · Tonight&apos;s service</p>

      <h1 className="editorial mt-3">
        {greeting},<br />
        <span className="serif-italic">{name}.</span>
      </h1>

      <p className="muted mt-5 max-w-[42ch]" style={{ fontSize: 17, lineHeight: 1.5 }}>
        {role ? <>Set as <span style={{ color: "var(--ink)", fontWeight: 500 }}>{role.toLowerCase()}</span>. </> : null}
        {savedCount > 0 ? <>{savedCount} saved {savedCount === 1 ? "job" : "jobs"} on file. </> : null}
        Where to next?
      </p>

      <div className="measure-rule">Continue</div>

      <div className="flex flex-wrap gap-2.5 mt-5">
        <button className="action-chip action-chip--primary" onClick={() => onAction("hunt")}>
          <ActionIcon type="hunt" />
          Fresh listings
        </button>
        <button className="action-chip" onClick={() => onAction("analyze")}>
          <ActionIcon type="analyze" />
          Paste a listing
        </button>
        <button className="action-chip" onClick={() => onAction("interview")}>
          <ActionIcon type="interview" />
          Practice answers
        </button>
        <button className="action-chip" onClick={() => onAction("resume")}>
          <ActionIcon type="resume" />
          Resume
        </button>
      </div>

      <div className="kbd-hint mt-7">
        <kbd>/</kbd> to start typing
      </div>
    </section>
  );
}

function OnboardChip({ label, onClick, ghost }: { label: string; onClick: () => void; ghost?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`onboard-chip ${ghost ? "onboard-chip--ghost" : ""}`}
    >
      {label}
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12h14M13 6l6 6-6 6" />
      </svg>
    </button>
  );
}

/* ── Bubble renderer ───────────────────────────────── */

function Bubble({ m, onAction }: { m: Message; onAction: (t: ActionType) => void }) {
  if (m.role === "assistant") return <div className="bubble bubble--ai">{m.content}</div>;
  if (m.role === "user")      return <div className="bubble bubble--you">{m.content}</div>;

  if (m.kind === "analysis") {
    const { job } = m.data;
    const v = computeVerdict(job);
    return (
      <div className="bubble bubble--rich">
        <div className="lg" style={{ padding: 22 }}>
          <div className="flex items-center justify-between gap-3 mb-3">
            <span className={`verdict verdict--${v.tone}`}>{v.label}</span>
            <div className="flex items-center gap-2">
              <span className="pay" style={{ fontSize: 18 }}>{job.pay}</span>
              <SaveHeart id={`a_${m.id}`} job={{ id: `a_${m.id}`, title: job.title, pay: job.pay, neighborhood: job.location, source: "analysis", savedAt: Date.now() }} />
            </div>
          </div>
          <p className="title-2">{job.title}</p>
          <p className="meta mt-1">{job.restaurant} · {job.location}</p>
          <p className="body mt-3">{v.reason}</p>
          {(job.greenFlags?.length > 0 || job.redFlags?.length > 0) && (
            <div className="mt-4 grid grid-cols-1 gap-2">
              {job.greenFlags?.length > 0 && (
                <div className="flag-list flag-list--good">
                  <p className="label">In favor</p>
                  <ul className="flag-items">
                    {job.greenFlags.slice(0, 3).map((f, i) => <li key={i}><span className="flag-bullet flag-bullet--good">+</span>{f}</li>)}
                  </ul>
                </div>
              )}
              {job.redFlags?.length > 0 && (
                <div className="flag-list">
                  <p className="label">Watch out</p>
                  <ul className="flag-items">
                    {job.redFlags.slice(0, 3).map((f, i) => <li key={i}><span className="flag-bullet">−</span>{f}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 mt-5">
            <button onClick={() => onAction("interview")} className="action-chip action-chip--primary">
              <ActionIcon type="interview" />
              Prep interview
            </button>
            <button onClick={() => onAction("resume")} className="action-chip">
              <ActionIcon type="resume" />
              Build resume
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (m.kind === "score") {
    const tier = m.data.score >= 7 ? "high" : m.data.score >= 5 ? "mid" : "low";
    return (
      <div className="bubble bubble--rich">
        <div className="lg flex items-center gap-4" style={{ padding: 18 }}>
          <span className={`metric-hero score--${tier}`} style={{ fontSize: 48 }}>
            {m.data.score}<span className="meta" style={{ color: "var(--ink-3)", fontSize: 13, marginLeft: 4, fontWeight: 500, fontFamily: "var(--font-mono-stack)" }}>/10</span>
          </span>
          <div className="flex-1 min-w-0">
            <p className="body" style={{ fontWeight: 500 }}>{m.data.verdict}</p>
          </div>
        </div>
      </div>
    );
  }
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
            <ActionIcon type="resume" />
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

/* ── Save heart — toggles save state for analyzed jobs ─────────── */

function SaveHeart({ id, job }: { id: string; job: { id: string; title: string; pay?: string; neighborhood?: string; source: "analysis" | "listing"; savedAt: number; url?: string } }) {
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isJobSaved(id)); }, [id]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved) { unsaveJob(id); setSaved(false); trackEvent("save_remove", { source: job.source }); }
    else { saveJob({ ...job, id }); setSaved(true); trackEvent("save_add", { source: job.source }); }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={`save-heart ${saved ? "save-heart--on" : ""}`}
      aria-label={saved ? "Unsave" : "Save"}
      aria-pressed={saved}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-4.4-9.3-9.1C1 9 2.5 5 6.4 5c2 0 3.4 1.1 4.6 2.6h2C14.2 6.1 15.6 5 17.6 5c3.9 0 5.4 4 3.7 6.9C19 16.6 12 21 12 21z" />
      </svg>
    </button>
  );
}

function Typing() {
  return (
    <div
      className="bubble bubble--ai typing"
      style={{ padding: "12px 16px" }}
      role="status"
      aria-live="polite"
      aria-label="Jigger is thinking"
    >
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
  // Bartender's jigger silhouette — two cones joined at the waist
  return (
    <span
      style={{
        width: 28, height: 28, borderRadius: 9,
        background: "var(--ink)", color: "#FFFFFF",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 4px 10px -3px rgba(10,10,10,0.30), inset 0 1px 0 rgba(255,255,255,0.12)",
      }}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M6 4 H18 L14 12 V12.5 L18 20 H6 L10 12.5 V12 Z" />
        <line x1="7.4" y1="7" x2="16.6" y2="7" strokeWidth="0.9" opacity="0.45" />
        <line x1="8.6" y1="9.4" x2="15.4" y2="9.4" strokeWidth="0.9" opacity="0.32" />
      </svg>
    </span>
  );
}

function ActionIcon({ type }: { type: ActionType }) {
  const common = { width: 14, height: 14, fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "hunt") return (
    <svg viewBox="0 0 24 24" {...common}>
      <circle cx="10.5" cy="10.5" r="6" />
      <path d="m20 20-4.4-4.4" />
    </svg>
  );
  if (type === "analyze") return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M3 7V5a2 2 0 0 1 2-2h2M21 7V5a2 2 0 0 0-2-2h-2M3 17v2a2 2 0 0 0 2 2h2M21 17v2a2 2 0 0 1-2 2h-2M7 12h10" />
    </svg>
  );
  if (type === "interview") return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </svg>
  );
  if (type === "resume") return (
    <svg viewBox="0 0 24 24" {...common}>
      <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
      <path d="M14 3v5h5" />
    </svg>
  );
  return (
    <svg viewBox="0 0 24 24" {...common}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M4 20c0-3.7 3.6-6.5 8-6.5s8 2.8 8 6.5" />
    </svg>
  );
}
