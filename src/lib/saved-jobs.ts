/**
 * Saved-job persistence — localStorage-backed.
 * Listings can be saved from the drawer or after analysis.
 */

const KEY = "shiftai_saved_jobs";

export type SavedJob = {
  id: string;
  title: string;
  url?: string;
  pay?: string;
  neighborhood?: string;
  savedAt: number;
  source: "listing" | "analysis";
};

export function getSavedJobs(): SavedJob[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveJob(job: SavedJob): void {
  if (typeof window === "undefined") return;
  const cur = getSavedJobs().filter((j) => j.id !== job.id);
  const next = [job, ...cur].slice(0, 50);
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
}

export function unsaveJob(id: string): void {
  if (typeof window === "undefined") return;
  const cur = getSavedJobs().filter((j) => j.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch {}
}

export function isJobSaved(id: string): boolean {
  return getSavedJobs().some((j) => j.id === id);
}
