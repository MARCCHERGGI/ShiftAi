"use client";

import { useEffect, useMemo, useRef } from "react";
import { getResearch } from "@/src/lib/research-store";
import { getProfile } from "@/src/lib/chat-store";

type AgentStatus = "idle" | "running" | "done";

type RunPhase =
  | "idle"
  | "analyzing"      // sendAnalyze in flight — show all running
  | "done";          // a research package exists

type AgentSpec = {
  no: string;
  name: string;
  role: string;
  // Pulls a 1-2 line evidence string from the saved research, when present
  evidence: (research: ReturnType<typeof getResearch>) => string | null;
};

const AGENTS: AgentSpec[] = [
  {
    no: "01",
    name: "Listing analyst",
    role: "Reads the posting. Pulls pay, schedule, requirements, red flags.",
    evidence: (r) => {
      if (!r?.job) return null;
      const bits: string[] = [];
      if (r.job.title) bits.push(r.job.title);
      if (r.job.pay && r.job.pay !== "Not listed") bits.push(r.job.pay);
      if (r.job.type) bits.push(r.job.type);
      return bits.join(" · ") || null;
    },
  },
  {
    no: "02",
    name: "Restaurant researcher",
    role: "Profiles the venue: vibe, clientele, what they're really known for.",
    evidence: (r) => {
      if (!r?.venue) return null;
      const bits: string[] = [];
      if (r.venue.type) bits.push(r.venue.type);
      if (r.venue.priceRange) bits.push(r.venue.priceRange);
      if (r.venue.knownFor) bits.push(r.venue.knownFor);
      return bits.join(" · ") || null;
    },
  },
  {
    no: "03",
    name: "Block intel",
    role: "Reads the neighborhood — foot traffic, transit, market pay, late-night safety.",
    evidence: (r) => {
      if (!r?.location) return null;
      const bits: string[] = [];
      if (r.location.neighborhood) bits.push(r.location.neighborhood);
      if (r.location.avgBarPay) bits.push(r.location.avgBarPay);
      return bits.join(" · ") || null;
    },
  },
  {
    no: "04",
    name: "What they actually want",
    role: "Cross-references the listing against the venue type to surface the unstated hire profile.",
    evidence: (r) => {
      if (!r?.job?.tips || r.job.tips.length === 0) return null;
      return r.job.tips[0];
    },
  },
  {
    no: "05",
    name: "Interview coach",
    role: "Generates 8 questions tailored to this exact venue and role.",
    evidence: (r) => {
      if (!r?.questions || r.questions.length === 0) return null;
      return `${r.questions.length} venue-specific questions`;
    },
  },
];

export default function AgentFlowSheet({
  open,
  onClose,
  phase,
}: {
  open: boolean;
  onClose: () => void;
  phase: RunPhase;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startT: number; dragging: boolean; delta: number }>({
    startY: 0, startT: 0, dragging: false, delta: 0,
  });

  const research = useMemo(() => (open ? getResearch() : null), [open]);
  const profile = useMemo(() => (open ? getProfile() : { name: undefined, role: undefined }), [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // ── Drag-to-dismiss ─────────────────────────────────
  const applyDrag = (delta: number) => {
    const el = sheetRef.current;
    if (!el) return;
    const drag = delta < 0 ? delta * 0.3 : delta;
    el.style.transform = `translateY(${drag}px)`;
    el.style.transition = "none";
  };
  const settleDrag = (close: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
    if (close) {
      el.style.transform = "translateY(100%)";
      setTimeout(onClose, 280);
    } else {
      el.style.transform = "translateY(0)";
    }
  };
  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = { startY: e.clientY, startT: Date.now(), dragging: true, delta: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.delta = e.clientY - d.startY;
    applyDrag(d.delta);
  };
  const onDragEnd = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    const v = d.delta / Math.max(50, Date.now() - d.startT);
    const close = d.delta > 120 || (d.delta > 40 && v > 0.6);
    settleDrag(close);
  };

  const lastRunAge = research?.createdAt
    ? humanAge(Date.parse(research.createdAt))
    : null;

  const statusOf = (i: number): AgentStatus => {
    if (phase === "analyzing") return "running";
    if (phase === "done" && research) {
      // Each agent reports done if its data is present
      const a = AGENTS[i];
      const ev = a.evidence(research);
      return ev ? "done" : "idle";
    }
    return "idle";
  };

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="sheet sheet--full" role="dialog" aria-label="Agent flow">
        <div
          className="sheet__grab"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <button type="button" onClick={onClose} aria-label="Close" className="sheet__handle-btn">
            <span className="sheet__handle" />
          </button>
        </div>

        <div className="sheet__topbar">
          <span className="sheet__title">The brain</span>
          <button type="button" onClick={onClose} className="sheet__done">Done</button>
        </div>

        <p className="label" style={{ marginBottom: 6 }}>
          {phase === "analyzing" ? "Live · running now" :
           phase === "done"      ? `Last run · ${lastRunAge}` :
                                   "Idle · paste a Manhattan listing to see them work"}
        </p>

        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 22 }}>
          Five specialists. They read the listing, profile the restaurant, study the block,
          decode the unstated hire profile, and prep your interview — all from one paste.
        </p>

        <ol className="agent-flow">
          {AGENTS.map((a, i) => {
            const status = statusOf(i);
            const ev = research ? a.evidence(research) : null;
            return (
              <li key={a.no} className={`agent-node agent-node--${status}`}>
                <div className="agent-node__col">
                  <span className={`agent-node__dot agent-node__dot--${status}`} aria-hidden />
                  {i < AGENTS.length - 1 && <span className="agent-node__connector" aria-hidden />}
                </div>
                <div className="agent-node__body">
                  <div className="agent-node__head">
                    <span className="agent-node__no">{a.no}</span>
                    <span className="agent-node__name">{a.name}</span>
                    <span className={`agent-node__status agent-node__status--${status}`}>
                      {status === "running" ? "Running" : status === "done" ? "Complete" : "Idle"}
                    </span>
                  </div>
                  <p className="agent-node__role">{a.role}</p>
                  {status === "done" && ev && (
                    <p className="agent-node__evidence">{ev}</p>
                  )}
                  {status === "running" && (
                    <p className="agent-node__evidence agent-node__evidence--running">
                      <span className="agent-node__shim" />
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {research?.job && (
          <div className="agent-flow__footer">
            <p className="label">Synthesis</p>
            <p className="serif-italic" style={{ fontSize: 22, lineHeight: 1.2, letterSpacing: "-0.02em", marginTop: 6 }}>
              {research.job.title}
            </p>
            <p className="meta" style={{ marginTop: 4 }}>
              {research.job.restaurant} · {research.job.location}
            </p>
            {profile.name && (
              <p className="label" style={{ marginTop: 16 }}>
                Reading for · {profile.name}{profile.role ? ` (${profile.role})` : ""}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function humanAge(ts: number): string {
  const d = Date.now() - ts;
  const m = Math.floor(d / 60_000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
