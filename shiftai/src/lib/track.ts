"use client";

import { track as vercelTrack } from "@vercel/analytics";

export type TrackProps = Record<string, string | number | boolean | null>;

const SESSION_KEY = "shiftai:session";

function sessionId(): string {
  if (typeof window === "undefined") return "server";
  let sid = window.sessionStorage.getItem(SESSION_KEY);
  if (!sid) {
    sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    window.sessionStorage.setItem(SESSION_KEY, sid);
  }
  return sid;
}

export function trackEvent(name: string, props: TrackProps = {}): void {
  if (typeof window === "undefined") return;

  const enriched: TrackProps = {
    ...props,
    path: window.location.pathname,
    referrer: document.referrer || "direct",
    session: sessionId(),
  };

  try {
    vercelTrack(name, enriched);
  } catch {}

  const payload = {
    name,
    props: enriched,
    ts: Date.now(),
    ua: navigator.userAgent,
  };

  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/api/track", blob);
    } else {
      void fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch {}
}
