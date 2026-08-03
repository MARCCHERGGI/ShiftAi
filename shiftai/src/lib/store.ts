/**
 * SSR-safe localStorage helpers for the two client-side documents:
 *   - Profile        → LS_PROFILE  ("shiftai.profile")
 *   - AnalyzeResult  → LS_ANALYSIS ("shiftai.lastAnalysis")
 *
 * Every function no-ops (returns null) on the server, so client components
 * can call these from effects without `typeof window` guards of their own.
 */

import {
  LS_ANALYSIS,
  LS_PROFILE,
  type AnalyzeResult,
  type Profile,
} from "@/src/lib/agents/types";

export function emptyProfile(): Profile {
  return {
    name: "",
    email: "",
    phone: "",
    neighborhood: "",
    role: "Bartender",
    yearsExperience: "",
    workHistory: [],
    skills: [],
    certs: [],
    signatureDrinks: [],
    languages: [],
    summary: "",
  };
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

/* ── Profile ─────────────────────────────────────── */

export function loadProfile(): Profile | null {
  const stored = read<Partial<Profile>>(LS_PROFILE);
  if (!stored) return null;
  // Merge over the empty shape so older saves missing newer fields stay valid.
  const base = emptyProfile();
  return {
    ...base,
    ...stored,
    workHistory: Array.isArray(stored.workHistory) ? stored.workHistory : [],
    skills: Array.isArray(stored.skills) ? stored.skills : [],
    certs: Array.isArray(stored.certs) ? stored.certs : [],
    signatureDrinks: Array.isArray(stored.signatureDrinks) ? stored.signatureDrinks : [],
    languages: Array.isArray(stored.languages) ? stored.languages : [],
  };
}

export function saveProfile(profile: Profile): boolean {
  return write(LS_PROFILE, profile);
}

/** A profile is usable once it has at least a name. */
export function hasUsableProfile(profile: Profile | null): profile is Profile {
  return !!profile && profile.name.trim().length > 0;
}

/* ── Analysis ────────────────────────────────────── */

export function loadAnalysis(): AnalyzeResult | null {
  const stored = read<AnalyzeResult>(LS_ANALYSIS);
  if (!stored || !stored.job || !stored.synthesis) return null;
  return stored;
}

export function saveAnalysis(analysis: AnalyzeResult): boolean {
  return write(LS_ANALYSIS, analysis);
}

export function clearAnalysis(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LS_ANALYSIS);
  } catch {
    /* ignore */
  }
}
