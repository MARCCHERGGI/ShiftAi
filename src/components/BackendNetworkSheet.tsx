"use client";

import { useEffect, useMemo, useRef } from "react";
import { getResearch } from "@/src/lib/research-store";
import { getProfile } from "@/src/lib/chat-store";
import { getSavedJobs } from "@/src/lib/saved-jobs";

type Phase = "idle" | "analyzing" | "done";
type NodeKind = "input" | "agent" | "engine" | "store" | "output" | "external";
type NodeStatus = "idle" | "active" | "done";

type Node = {
  id: string;
  kind: NodeKind;
  label: string;
  hint?: string;
  x: number; y: number;
  // viewBox coordinates within an 800×1100 canvas
};

type Edge = {
  from: string; to: string;
  // Bezier curvature signal (-1 left bow, 0 straight, +1 right bow)
  bow?: number;
  // If true, this edge is animated when phase=analyzing
  hot?: boolean;
};

const CANVAS_W = 800;
const CANVAS_H = 1100;

// ── Topology ────────────────────────────────────────────────────────
const NODES: Node[] = [
  // Tier 1 — sources / inputs (top)
  { id: "user",      kind: "input",    label: "User Input",    hint: "composer",        x: 80,  y: 90  },
  { id: "profile",   kind: "store",    label: "Profile",       hint: "localStorage",    x: 240, y: 90  },
  { id: "saved",     kind: "store",    label: "Saved Jobs",    hint: "localStorage",    x: 400, y: 90  },
  { id: "history",   kind: "store",    label: "History",       hint: "last 30 runs",    x: 560, y: 90  },
  { id: "craigs",    kind: "external", label: "Craigslist",    hint: "Manhattan FOH",   x: 720, y: 90  },

  // Tier 2 — routing layer
  { id: "intent",    kind: "agent",    label: "Intent Router",  hint: "free vs analyze", x: 160, y: 230 },
  { id: "chat",      kind: "agent",    label: "Conversational",  hint: "system prompt",   x: 320, y: 230 },
  { id: "fetch",     kind: "agent",    label: "Listings Fetcher", hint: "/api/listings",  x: 640, y: 230 },

  // Tier 3 — specialists (the 5-agent pipeline)
  { id: "analyst",   kind: "agent",    label: "Listing Analyst",      hint: "Agent 1",  x: 160, y: 380 },
  { id: "venue",     kind: "agent",    label: "Restaurant Researcher", hint: "Agent 2", x: 320, y: 380 },
  { id: "block",     kind: "agent",    label: "Block Intel",          hint: "Agent 3",  x: 480, y: 380 },
  { id: "decode",    kind: "agent",    label: "Hire-profile Decoder",  hint: "implicit", x: 640, y: 380 },

  // Tier 4 — synthesis / coaching
  { id: "verdict",   kind: "agent",    label: "Verdict Synthesizer",  hint: "computeVerdict", x: 160, y: 540 },
  { id: "qgen",      kind: "agent",    label: "Q-Generator",          hint: "Agent 4",       x: 320, y: 540 },
  { id: "eval",      kind: "agent",    label: "Answer Evaluator",     hint: "Agent 5",       x: 480, y: 540 },
  { id: "tailor",    kind: "agent",    label: "Resume Tailor",        hint: "Agent 6",       x: 640, y: 540 },

  // Engine (cloud LLM)
  { id: "openai",    kind: "engine",   label: "OpenAI",       hint: "gpt-4o-mini",    x: 400, y: 700 },

  // Outputs
  { id: "outVerdict", kind: "output",  label: "Verdict",        hint: "bubble",         x: 100, y: 870 },
  { id: "outQs",      kind: "output",  label: "Question Pack",  hint: "8 venue Qs",     x: 280, y: 870 },
  { id: "outScore",   kind: "output",  label: "Score",          hint: "/10 + tips",     x: 460, y: 870 },
  { id: "outResume",  kind: "output",  label: "Resume PDF",     hint: "tailored",       x: 640, y: 870 },
];

const EDGES: Edge[] = [
  // Sources → Routers/Fetcher
  { from: "user",    to: "intent",  hot: true },
  { from: "profile", to: "chat" },
  { from: "saved",   to: "chat" },
  { from: "history", to: "chat" },
  { from: "craigs",  to: "fetch" },
  { from: "fetch",   to: "user", bow: -1 },

  // Router branches
  { from: "intent",  to: "chat" },
  { from: "intent",  to: "analyst", hot: true },

  // Analyst feeds the next-tier specialists
  { from: "analyst", to: "venue",  hot: true },
  { from: "analyst", to: "block",  hot: true },
  { from: "analyst", to: "decode", hot: true },
  { from: "venue",   to: "decode" },
  { from: "block",   to: "decode" },

  // Specialists → synthesis
  { from: "analyst", to: "verdict", bow: -1, hot: true },
  { from: "decode",  to: "verdict" },
  { from: "venue",   to: "qgen",    hot: true },
  { from: "decode",  to: "qgen" },
  { from: "qgen",    to: "eval" },
  { from: "venue",   to: "tailor",  hot: true },
  { from: "decode",  to: "tailor" },

  // Engine ← agents (LLM calls)
  { from: "analyst", to: "openai",  bow: 1 },
  { from: "venue",   to: "openai" },
  { from: "block",   to: "openai" },
  { from: "qgen",    to: "openai" },
  { from: "eval",    to: "openai", bow: -1 },
  { from: "tailor",  to: "openai" },
  { from: "chat",    to: "openai", bow: 1 },

  // Outputs
  { from: "verdict", to: "outVerdict", hot: true },
  { from: "qgen",    to: "outQs" },
  { from: "eval",    to: "outScore" },
  { from: "tailor",  to: "outResume" },
];

// ── Sheet ───────────────────────────────────────────────────────────
export default function BackendNetworkSheet({
  open,
  onClose,
  phase,
}: {
  open: boolean;
  onClose: () => void;
  phase: Phase;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startT: number; dragging: boolean; delta: number }>({
    startY: 0, startT: 0, dragging: false, delta: 0,
  });

  const research = useMemo(() => (open ? getResearch() : null), [open]);
  const profile = useMemo(() => (open ? getProfile() : { name: undefined, role: undefined }), [open]);
  const savedCount = useMemo(() => (open ? getSavedJobs().length : 0), [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // ── Drag-to-dismiss
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
    settleDrag(d.delta > 120 || (d.delta > 40 && v > 0.6));
  };

  // ── Status by node — derived from current phase + last research
  const statusOf = (id: string): NodeStatus => {
    const isStore = NODES.find((n) => n.id === id)?.kind === "store";
    const isExternal = NODES.find((n) => n.id === id)?.kind === "external";
    const isEngine = id === "openai";

    if (phase === "analyzing") {
      // Active set during a run: input → analyst pipeline → outputs
      const active = new Set([
        "user", "intent", "analyst", "venue", "block", "decode",
        "qgen", "tailor", "verdict", "openai",
      ]);
      if (active.has(id)) return "active";
      return "idle";
    }
    if (phase === "done" && research) {
      // Mark agents whose evidence is present as done
      const map: Record<string, boolean> = {
        user: true, intent: true, profile: !!profile.name, saved: savedCount > 0, history: true, craigs: true,
        chat: true, fetch: true, openai: true,
        analyst: !!research.job, venue: !!research.venue, block: !!research.location,
        decode: !!research.job?.tips?.length, qgen: !!research.questions?.length,
        eval: false, tailor: false,
        verdict: !!research.job, outVerdict: !!research.job, outQs: !!research.questions?.length,
        outScore: false, outResume: false,
      };
      return map[id] ? "done" : "idle";
    }
    // Idle — only persistent stores/externals show "done"
    if (isStore || isExternal || isEngine) return "done";
    return "idle";
  };

  const lastRunAge = research?.createdAt
    ? humanAge(Date.parse(research.createdAt))
    : null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="sheet sheet--full" role="dialog" aria-label="The backend">
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
          <span className="sheet__title">The backend</span>
          <button type="button" onClick={onClose} className="sheet__done">Done</button>
        </div>

        <p className="label" style={{ marginBottom: 6 }}>
          {phase === "analyzing" ? "Live · agents firing now" :
           phase === "done"      ? `Last run · ${lastRunAge}` :
                                   "Idle · the system at rest"}
        </p>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 14 }}>
          {NODES.length} agents and systems, wired end to end. Inputs flow down. The cloud brain is shared.
        </p>

        <div className="net-canvas">
          <svg
            viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
            preserveAspectRatio="xMidYMin meet"
            className="net-svg"
            aria-hidden
          >
            <defs>
              <filter id="net-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Edges first so nodes paint on top */}
            {EDGES.map((e, i) => {
              const a = NODES.find((n) => n.id === e.from);
              const b = NODES.find((n) => n.id === e.to);
              if (!a || !b) return null;
              const path = bezier(a.x, a.y, b.x, b.y, e.bow ?? 0);
              const live = phase === "analyzing" && e.hot;
              const sa = statusOf(e.from);
              const sb = statusOf(e.to);
              const lit = sa !== "idle" && sb !== "idle";
              return (
                <path
                  key={i}
                  d={path}
                  className={`net-edge ${live ? "net-edge--live" : ""} ${lit ? "net-edge--lit" : ""}`}
                  fill="none"
                />
              );
            })}

            {/* Nodes */}
            {NODES.map((n) => {
              const s = statusOf(n.id);
              const w = nodeW(n);
              const h = nodeH(n);
              return (
                <g key={n.id} transform={`translate(${n.x - w / 2}, ${n.y - h / 2})`}>
                  <rect
                    width={w}
                    height={h}
                    rx={n.kind === "engine" ? h / 2 : 12}
                    className={`net-node net-node--${n.kind} net-node--${s}`}
                  />
                  {/* Status dot */}
                  <circle
                    cx={10}
                    cy={10}
                    r={3}
                    className={`net-dot net-dot--${s}`}
                  />
                  <text
                    x={w / 2}
                    y={h / 2 - (n.hint ? 4 : 0)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={`net-label net-label--${n.kind}`}
                  >
                    {n.label}
                  </text>
                  {n.hint && (
                    <text
                      x={w / 2}
                      y={h / 2 + 12}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="net-hint"
                    >
                      {n.hint}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Legend */}
        <div className="net-legend">
          <span className="net-legend__item"><span className="net-legend__sw net-legend__sw--input" />Sources</span>
          <span className="net-legend__item"><span className="net-legend__sw net-legend__sw--agent" />Agents</span>
          <span className="net-legend__item"><span className="net-legend__sw net-legend__sw--engine" />Engine</span>
          <span className="net-legend__item"><span className="net-legend__sw net-legend__sw--output" />Outputs</span>
        </div>
      </div>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────
function nodeW(n: Node): number {
  if (n.kind === "engine") return 130;
  if (n.kind === "external" || n.kind === "store" || n.kind === "input" || n.kind === "output") return 130;
  return 150;
}
function nodeH(n: Node): number {
  if (n.kind === "engine") return 56;
  return 56;
}

function bezier(x1: number, y1: number, x2: number, y2: number, bow: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Curvature factor — orthogonal offset from midpoint
  const mx = (x1 + x2) / 2 + bow * 60;
  const my = (y1 + y2) / 2;
  const c1x = x1;
  const c1y = y1 + dy * 0.5;
  const c2x = x2;
  const c2y = y2 - dy * 0.5;
  // Use a quadratic via single control point that's offset perpendicular
  return `M ${x1},${y1} C ${c1x + bow * 30},${c1y} ${c2x + bow * 30},${c2y} ${x2},${y2}`;
  void mx; void my; void dx;
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
