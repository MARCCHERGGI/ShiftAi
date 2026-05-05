"use client";

import { useEffect, useRef, useState } from "react";
import { getProfile, saveProfile, clearThread, type Profile } from "@/src/lib/chat-store";
import { getAnalysisHistory, getInterviewSessions } from "@/src/lib/research-store";

const ROLES = ["Bartender", "Server", "Barback", "Chef", "Manager"];
const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export default function ProfileSheet({
  open,
  onClose,
  onProfileChange,
  onThreadCleared,
}: {
  open: boolean;
  onClose: () => void;
  onProfileChange?: (p: Profile) => void;
  onThreadCleared?: () => void;
}) {
  const [profile, setProfile] = useState<Profile>({});
  const [stats, setStats] = useState({ listings: 0, interviews: 0, avg: null as number | null });
  const [roleOpen, setRoleOpen] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startY: number; startT: number; dragging: boolean; delta: number }>({
    startY: 0, startT: 0, dragging: false, delta: 0,
  });

  useEffect(() => {
    if (!open) return;
    setProfile(getProfile());
    const s = getInterviewSessions();
    setStats({
      listings: getAnalysisHistory().length,
      interviews: s.length,
      avg: s.length ? Math.round(s.reduce((a, x) => a + x.score, 0) / s.length) : null,
    });
    setPhotoError(null);
    setConfirmClear(false);
    setRoleOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  // ── Drag-to-dismiss (iOS sheet convention) ────────────
  const applyDrag = (delta: number) => {
    const el = sheetRef.current;
    if (!el) return;
    const clamped = Math.max(0, delta);
    const drag = clamped < 0 ? clamped * 0.3 : clamped;   // rubber-band on overscroll up
    el.style.transform = `translateY(${drag}px)`;
    el.style.transition = "none";
  };

  const settleDrag = (shouldClose: boolean) => {
    const el = sheetRef.current;
    if (!el) return;
    el.style.transition = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
    if (shouldClose) {
      el.style.transform = "translateY(100%)";
      setTimeout(onClose, 280);
    } else {
      el.style.transform = "translateY(0)";
    }
  };

  const onDragStart = (e: React.PointerEvent) => {
    // Only start drag from the handle area — not content
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
    const velocity = d.delta / Math.max(50, Date.now() - d.startT); // px/ms
    const shouldClose = d.delta > 120 || (d.delta > 40 && velocity > 0.6);
    settleDrag(shouldClose);
  };

  const update = (patch: Partial<Profile>) => {
    const next = { ...profile, ...patch };
    setProfile(next);
    saveProfile(next);
    onProfileChange?.(next);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("Photo too large (max 2 MB).");
      event.target.value = "";
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoError("That doesn't look like an image.");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      try { update({ photo: reader.result as string }); }
      catch { setPhotoError("Storage full — try a smaller photo."); }
    };
    reader.onerror = () => setPhotoError("Couldn't read photo.");
    reader.readAsDataURL(file);
  };

  const initial = (profile.name || "Y").charAt(0).toUpperCase();
  const roleLabel = profile.role || "Bartender";
  const displayName = profile.name || "Set your name";

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div ref={sheetRef} className="sheet" role="dialog" aria-label="Profile">
        {/* Drag handle — grab here to pull down */}
        <div
          className="sheet__grab"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="sheet__handle-btn"
          >
            <span className="sheet__handle" />
          </button>
        </div>

        {/* Top action bar — iOS-standard "Done" button */}
        <div className="sheet__topbar">
          <span className="sheet__title">Profile</span>
          <button
            type="button"
            onClick={onClose}
            className="sheet__done"
            aria-label="Done"
          >
            Done
          </button>
        </div>

        {/* ── Hero: avatar + name + stats all in one Liquid Glass card ── */}
        <section className="lg profile-hero fade-in" style={{ padding: 22 }}>
          <div className="flex flex-col items-center">
            <label
              className="relative cursor-pointer active:scale-95 transition-transform"
              style={{ touchAction: "manipulation", transitionTimingFunction: "var(--ease-spring)" }}
            >
              {profile.photo ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={profile.photo}
                  alt=""
                  className="rounded-full object-cover"
                  style={{
                    width: 88, height: 88,
                    border: "3px solid rgba(255,255,255,0.95)",
                    boxShadow: "0 10px 24px -8px rgba(31,38,135,0.28)",
                  }}
                />
              ) : (
                <span
                  className="inline-flex items-center justify-center rounded-full"
                  style={{
                    width: 88, height: 88,
                    background: "linear-gradient(180deg, #1a1a1a 0%, var(--ink) 100%)",
                    color: "#FFFFFF",
                    fontSize: 38,
                    fontWeight: 700,
                    letterSpacing: "-0.04em",
                    border: "3px solid rgba(255,255,255,0.95)",
                    boxShadow: "0 10px 24px -8px rgba(0,0,0,0.30)",
                  }}
                >
                  {initial}
                </span>
              )}
              <span
                className="absolute inline-flex items-center justify-center"
                style={{
                  bottom: -2, right: -2,
                  width: 28, height: 28, borderRadius: 14,
                  background: "var(--ink)",
                  color: "#FFFFFF",
                  border: "2.5px solid #FFFFFF",
                  boxShadow: "0 4px 10px -2px rgba(0,0,0,0.30)",
                }}
              >
                <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <path d="M9 4h6l1.3 2H21a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h4.7z" />
                  <circle cx="12" cy="13" r="3.6" fill="var(--ink)" />
                </svg>
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>

            <h2
              className="mt-4"
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: "-0.022em",
                color: "var(--ink)",
                textAlign: "center",
              }}
            >
              {displayName}
            </h2>
            <p className="muted mt-0.5" style={{ fontSize: 14 }}>
              {roleLabel}
              {profile.experience ? ` · ${profile.experience}` : ""}
            </p>

            {photoError && (
              <p className="caption mt-2" style={{ color: "var(--ink)", fontWeight: 600 }}>
                {photoError}
              </p>
            )}
          </div>

          {/* Stats — only shown once user has actual activity */}
          {(stats.listings > 0 || stats.interviews > 0) && (
            <div
              className="grid grid-cols-3 mt-5 pt-5"
              style={{ borderTop: "1px solid var(--hairline)" }}
            >
              <InlineStat label="Listings"   value={stats.listings} />
              <InlineStat label="Interviews" value={stats.interviews} hasDivider />
              <InlineStat label="Avg score"  value={stats.avg ?? "—"} unit={stats.avg != null ? "/100" : undefined} hasDivider />
            </div>
          )}
        </section>

        {/* ── Details: single grouped list inside Liquid Glass ── */}
        <section className="lg mt-4 fade-in stagger-1 profile-list" style={{ padding: 0 }}>
          <FieldRow
            label="Name"
            value={profile.name || ""}
            placeholder="Your name"
            onChange={(v) => update({ name: v })}
            autoComplete="given-name"
          />
          <Divider />
          <button
            type="button"
            className="profile-row"
            onClick={() => setRoleOpen((v) => !v)}
            style={{ touchAction: "manipulation" }}
          >
            <span className="profile-row__label">Role</span>
            <span className="profile-row__value">
              <span>{roleLabel}</span>
              <svg
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  color: "var(--ink-4)",
                  marginLeft: 4,
                  transform: roleOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 280ms var(--ease-spring)",
                }}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </span>
          </button>

          {/* Fluid role picker — height animates via max-height */}
          <div
            ref={pickerRef}
            className="profile-picker"
            style={{
              maxHeight: roleOpen ? (pickerRef.current?.scrollHeight || 280) : 0,
              opacity: roleOpen ? 1 : 0,
            }}
            aria-hidden={!roleOpen}
          >
            {ROLES.map((r, i) => (
              <button
                key={r}
                type="button"
                onClick={() => { update({ role: r }); setRoleOpen(false); }}
                className="profile-picker__item"
                style={{
                  borderTop: i > 0 ? "1px solid var(--hairline)" : "1px solid var(--hairline)",
                  touchAction: "manipulation",
                }}
              >
                <span style={{ fontWeight: profile.role === r ? 600 : 400 }}>{r}</span>
                {profile.role === r && (
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="var(--ink)"
                    strokeWidth="2.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12.5 10 17l9-10" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <Divider />
          <FieldRow
            label="Experience"
            value={profile.experience || ""}
            placeholder="e.g. 2 years craft cocktails"
            onChange={(v) => update({ experience: v })}
          />
        </section>

        {/* ── About: simple row list on Liquid Glass ── */}
        <section className="lg mt-4 fade-in stagger-2 profile-list" style={{ padding: 0 }}>
          <LinkRow href="/privacy" label="Privacy" />
          <Divider />
          <LinkRow href="/terms"   label="Terms" />
          <Divider />
          <LinkRow href="/support" label="Support" />
        </section>

        {/* ── Danger ── */}
        <div className="mt-5 fade-in stagger-3">
          {!confirmClear ? (
            <button
              type="button"
              onClick={() => setConfirmClear(true)}
              className="btn-ghost"
              style={{ width: "100%", color: "var(--ink-3)" }}
            >
              Clear conversation
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmClear(false)}
                className="btn-ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  clearThread();
                  onThreadCleared?.();
                  setConfirmClear(false);
                  onClose();
                }}
                className="btn-primary"
                style={{ flex: 1 }}
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <p className="caption text-center mt-6" style={{ color: "var(--ink-4)" }}>
          Jigger · v1.0
        </p>
      </div>
    </>
  );
}

/* ─────────────────────────────────────────────────────── */

function InlineStat({
  label,
  value,
  unit,
  hasDivider,
}: {
  label: string;
  value: string | number;
  unit?: string;
  hasDivider?: boolean;
}) {
  return (
    <div
      className="text-center relative"
      style={hasDivider ? { borderLeft: "1px solid var(--hairline)" } : undefined}
    >
      <p className="metric" style={{ fontSize: 22, lineHeight: 1 }}>
        {value}
        {unit && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: "var(--ink-3)",
              marginLeft: 2,
            }}
          >
            {unit}
          </span>
        )}
      </p>
      <p
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
          marginTop: 4,
        }}
      >
        {label}
      </p>
    </div>
  );
}

function FieldRow({
  label,
  value,
  placeholder,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="profile-row profile-row--input">
      <span className="profile-row__label">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="profile-row__input"
      />
    </label>
  );
}

function LinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="profile-row"
      style={{ textDecoration: "none", color: "var(--ink)", touchAction: "manipulation" }}
    >
      <span className="profile-row__label" style={{ width: "auto", fontSize: 16, color: "var(--ink)", fontWeight: 500, letterSpacing: "-0.008em", textTransform: "none" }}>
        {label}
      </span>
      <span className="profile-row__value" style={{ color: "var(--ink-4)" }}>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17 17 7M9 7h8v8" />
        </svg>
      </span>
    </a>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "var(--hairline)", marginLeft: 18 }} />;
}
