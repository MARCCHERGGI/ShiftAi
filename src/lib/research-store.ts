import type { ResearchPackage, InterviewResult } from "./types";

const RESEARCH_KEY  = "shiftai_research";
const INTERVIEW_KEY = "shiftai_interview";
const HISTORY_KEY   = "shiftai_history";
const SESSIONS_KEY  = "shiftai_interview_sessions";
const MAX_HISTORY   = 30;

export type StoredAnalysis = ResearchPackage & { savedAt: number };
export type InterviewSession = {
  id: string;
  finishedAt: number;
  score: number;
  count: number;
  job?: string;
  venue?: string;
};

export function saveResearch(data: ResearchPackage): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RESEARCH_KEY, JSON.stringify(data));
    pushHistory(data);
  } catch { /* swallow */ }
}

export function getResearch(): ResearchPackage | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(RESEARCH_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearResearch(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RESEARCH_KEY);
}

function pushHistory(data: ResearchPackage): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: StoredAnalysis[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((x) => x.id !== data.id);
    filtered.unshift({ ...data, savedAt: Date.now() });
    localStorage.setItem(
      HISTORY_KEY,
      JSON.stringify(filtered.slice(0, MAX_HISTORY))
    );
  } catch { /* swallow */ }
}

export function getAnalysisHistory(): StoredAnalysis[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function removeFromHistory(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: StoredAnalysis[] = raw ? JSON.parse(raw) : [];
    const next = list.filter((x) => x.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    const active = getResearch();
    if (active?.id === id) clearResearch();
  } catch { /* swallow */ }
}

export function pinFromHistory(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: StoredAnalysis[] = raw ? JSON.parse(raw) : [];
    const found = list.find((x) => x.id === id);
    if (found) {
      const { savedAt: _t, ...pkg } = found;
      void _t;
      localStorage.setItem(RESEARCH_KEY, JSON.stringify(pkg));
    }
  } catch { /* swallow */ }
}

export function saveInterviewResults(results: InterviewResult[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(INTERVIEW_KEY, JSON.stringify(results));
    if (results.length > 0) pushSession(results);
  } catch { /* swallow */ }
}

export function getInterviewResults(): InterviewResult[] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(INTERVIEW_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function pushSession(results: InterviewResult[]): void {
  if (typeof window === "undefined") return;
  try {
    const avg =
      results.reduce((s, r) => s + (r.evaluation?.score || 0), 0) /
      results.length;
    const score = Math.round(avg * 10);
    const research = getResearch();
    const session: InterviewSession = {
      id: `s_${Date.now().toString(36)}`,
      finishedAt: Date.now(),
      score,
      count: results.length,
      job: research?.job?.title,
      venue: research?.venue?.name || research?.job?.restaurant,
    };
    const raw = localStorage.getItem(SESSIONS_KEY);
    const list: InterviewSession[] = raw ? JSON.parse(raw) : [];
    list.unshift(session);
    localStorage.setItem(
      SESSIONS_KEY,
      JSON.stringify(list.slice(0, MAX_HISTORY))
    );
  } catch { /* swallow */ }
}

export function getInterviewSessions(): InterviewSession[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(SESSIONS_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}
