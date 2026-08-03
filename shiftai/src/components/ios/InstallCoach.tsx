"use client";

/**
 * Install coach mark — the only A2HS path on iOS Safari (no
 * `beforeinstallprompt` there). A dismissible white card above the tab
 * bar: on iOS Safari it teaches Share → Add to Home Screen; on
 * Android/desktop Chrome it captures `beforeinstallprompt` and offers a
 * real Install button. Renders nothing when already installed
 * (standalone) or previously dismissed (localStorage).
 *
 * Timing: never on first paint — shows after the first saved prep
 * (LS_ANALYSIS exists, short beat) or 25s after mount, whichever first.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Share, X } from "lucide-react";

import { loadAnalysis } from "@/src/lib/store";
import { trackEvent } from "@/src/lib/track";

const DISMISS_KEY = "shiftai.installCoachDismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

type CoachMode = "ios" | "prompt";

function isStandalone(): boolean {
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return "standalone" in nav && nav.standalone === true;
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent;
  if (!/iPhone|iPad|iPod/.test(ua) && !(/Macintosh/.test(ua) && "ontouchend" in document)) {
    return false;
  }
  // Exclude iOS Chrome/Firefox/Edge — their share sheet differs and they
  // can't A2HS a PWA anyway.
  return !/CriOS|FxiOS|EdgiOS/.test(ua);
}

export default function InstallCoach() {
  const [mode, setMode] = useState<CoachMode | null>(null);
  const [closing, setClosing] = useState(false);
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    if (isStandalone()) return;
    let dismissed = false;
    try {
      dismissed = window.localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* private mode — just show */
    }
    if (dismissed) return;

    const timers: number[] = [];
    const show = (m: CoachMode) => {
      if (shownRef.current) return;
      shownRef.current = true;
      setMode(m);
      trackEvent("install_coach_shown", { mode: m });
    };

    if (isIosSafari()) {
      // After the first completed prep, or 25s in — never on first paint.
      timers.push(
        loadAnalysis()
          ? window.setTimeout(() => show("ios"), 1200)
          : window.setTimeout(() => show("ios"), 25000),
      );
    }

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      show("prompt");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    };
  }, []);

  const hide = useCallback(() => {
    setClosing(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    window.setTimeout(() => setMode(null), 320);
  }, []);

  const dismiss = useCallback(() => {
    trackEvent("install_coach_dismissed");
    hide();
  }, [hide]);

  const install = useCallback(async () => {
    const deferred = promptRef.current;
    if (!deferred) return;
    promptRef.current = null;
    await deferred.prompt();
    const choice = await deferred.userChoice;
    if (choice.outcome === "accepted") trackEvent("install_accepted");
    hide();
  }, [hide]);

  if (!mode) return null;

  return (
    <div
      className={closing ? "install-coach install-coach--closing" : "install-coach"}
      role="dialog"
      aria-label="Install Shift AI"
    >
      <span className="install-coach__glyph" aria-hidden="true">
        <Share size={20} strokeWidth={2} />
      </span>
      <p className="install-coach__text">
        {mode === "ios" ? (
          <>
            <strong>Install Shift AI</strong> — tap Share, then &ldquo;Add to Home
            Screen&rdquo;.
          </>
        ) : (
          <>
            <strong>Install Shift AI</strong> — full screen, on your home screen.
          </>
        )}
      </p>
      {mode === "prompt" ? (
        <button type="button" className="install-coach__install" onClick={() => void install()}>
          Install
        </button>
      ) : null}
      <button
        type="button"
        className="install-coach__close"
        onClick={dismiss}
        aria-label="Dismiss install tip"
      >
        <X size={18} strokeWidth={2} />
      </button>
    </div>
  );
}

export { InstallCoach };
