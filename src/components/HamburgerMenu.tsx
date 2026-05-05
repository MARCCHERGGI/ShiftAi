"use client";

import { useEffect, useRef } from "react";

export default function HamburgerMenu({
  open,
  onClose,
  onPickListings,
  onPickBackend,
}: {
  open: boolean;
  onClose: () => void;
  onPickListings: () => void;
  onPickBackend: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="sheet" role="dialog" aria-label="Menu">
        <div className="sheet__grab">
          <button type="button" onClick={onClose} aria-label="Close" className="sheet__handle-btn">
            <span className="sheet__handle" />
          </button>
        </div>

        <div className="sheet__topbar">
          <span className="sheet__title">Menu</span>
          <button type="button" onClick={onClose} className="sheet__done">Done</button>
        </div>

        <p className="label" style={{ marginBottom: 14 }}>Two ways in</p>

        <div className="menu-stack">
          <button type="button" className="menu-card" onClick={onPickListings}>
            <span className="menu-card__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="5" width="16" height="14" rx="2.5" />
                <path d="M8 9.5h8M8 13h8M8 16.5h5" />
              </svg>
            </span>
            <span className="menu-card__body">
              <span className="menu-card__title">Job listings</span>
              <span className="menu-card__sub">Live Manhattan FOH — server, bartender, host, runner, barback</span>
            </span>
            <span className="menu-card__arrow" aria-hidden>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </button>

          <button type="button" className="menu-card" onClick={onPickBackend}>
            <span className="menu-card__icon" aria-hidden>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="5"  cy="6"  r="1.6" />
                <circle cx="12" cy="6"  r="1.6" />
                <circle cx="19" cy="6"  r="1.6" />
                <circle cx="5"  cy="12" r="1.6" />
                <circle cx="12" cy="12" r="1.6" fill="currentColor" />
                <circle cx="19" cy="12" r="1.6" />
                <circle cx="5"  cy="18" r="1.6" />
                <circle cx="12" cy="18" r="1.6" />
                <circle cx="19" cy="18" r="1.6" />
                <path d="M6.4 6.6 10.6 11.4M13.4 6.6 17.6 11.4M6.4 11.4 10.6 6.6M13.4 11.4 17.6 6.6M6.4 12.6 10.6 17.4M13.4 12.6 17.6 17.4M6.4 17.4 10.6 12.6M13.4 17.4 17.6 12.6" strokeWidth="0.8" opacity="0.5" />
              </svg>
            </span>
            <span className="menu-card__body">
              <span className="menu-card__title">The backend</span>
              <span className="menu-card__sub">Live agent network. See every system that&apos;s working for you.</span>
            </span>
            <span className="menu-card__arrow" aria-hidden>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 6l6 6-6 6" />
              </svg>
            </span>
          </button>
        </div>

        <p className="caption" style={{ marginTop: 18, color: "var(--ink-4)", textAlign: "center" }}>
          Jigger · Manhattan FOH
        </p>
      </div>
    </>
  );
}
