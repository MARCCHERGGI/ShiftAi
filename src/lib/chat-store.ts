/**
 * Persists the chat thread + the user profile in localStorage.
 * Single source of truth — every screen reads from these.
 */

import type { ResearchPackage } from "./types";

const THREAD_KEY  = "shiftai_thread";
const PROFILE_KEY = "shiftai_profile";

export type Profile = {
  name?: string;
  role?: string;
  experience?: string;
  photo?: string | null;
};

export type Message =
  | { id: string; role: "user";      content: string;       ts: number }
  | { id: string; role: "assistant"; content: string;       ts: number }
  | { id: string; role: "tool";      kind: "analysis"; data: ResearchPackage; ts: number }
  | { id: string; role: "tool";      kind: "score";    data: { score: number; verdict: string; question: string; answer: string }; ts: number }
  | { id: string; role: "tool";      kind: "resume";   data: { name: string; bytes: number }; ts: number };

const newId = () => `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

export function getThread(): Message[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(THREAD_KEY);
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export function saveThread(messages: Message[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(THREAD_KEY, JSON.stringify(messages));
  } catch {
    // Likely quota — drop oldest half and retry
    try {
      const half = messages.slice(-Math.floor(messages.length / 2));
      localStorage.setItem(THREAD_KEY, JSON.stringify(half));
    } catch { /* give up silently */ }
  }
}

export type MessageInput =
  | { role: "user"; content: string }
  | { role: "assistant"; content: string }
  | { role: "tool"; kind: "analysis"; data: ResearchPackage }
  | { role: "tool"; kind: "score"; data: { score: number; verdict: string; question: string; answer: string } }
  | { role: "tool"; kind: "resume"; data: { name: string; bytes: number } };

const MAX_THREAD = 200;

export function appendMessage(m: MessageInput): Message {
  const msg = { id: newId(), ts: Date.now(), ...m } as Message;
  const cur = getThread();
  const next = [...cur, msg];
  // FIFO trim so localStorage doesn't hit its ~5MB quota
  const trimmed = next.length > MAX_THREAD ? next.slice(-MAX_THREAD) : next;
  saveThread(trimmed);
  return msg;
}

export function clearThread(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(THREAD_KEY);
}

export function getProfile(): Profile {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

export function saveProfile(p: Profile): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)); } catch {}
}
