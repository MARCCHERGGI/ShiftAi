import type { ResearchPackage, InterviewResult } from "./types";

const RESEARCH_KEY = "shiftai_research";
const INTERVIEW_KEY = "shiftai_interview";

export function saveResearch(data: ResearchPackage): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RESEARCH_KEY, JSON.stringify(data));
}

export function getResearch(): ResearchPackage | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(RESEARCH_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearResearch(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(RESEARCH_KEY);
}

export function saveInterviewResults(results: InterviewResult[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(INTERVIEW_KEY, JSON.stringify(results));
}

export function getInterviewResults(): InterviewResult[] | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(INTERVIEW_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
