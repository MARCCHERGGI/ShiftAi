"use client";

import { useEffect, useRef, useState } from "react";
import { saveJob, unsaveJob, isJobSaved } from "@/src/lib/saved-jobs";

type Listing = {
  id: string;
  title: string;
  url: string;
  neighborhood?: string;
  postedAt: number;
  snippet?: string;
  source: "craigslist";
  city: string;
};

// Manhattan-only by design. Other Craigslist subareas exist (brk, brx, qns, stn) but
// Jigger is scoped to Manhattan FOH per product brief.
const CITIES: { id: string; label: string }[] = [
  { id: "newyork", label: "Manhattan" },
];

const QUERIES = ["server", "bartender", "host", "runner", "barback", "captain"];

function relTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1)  return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function RowHeart({ listing, pay }: { listing: Listing; pay: string | null }) {
  const id = `l_${listing.id}`;
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(isJobSaved(id)); }, [id]);
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (saved) { unsaveJob(id); setSaved(false); }
    else { saveJob({ id, title: listing.title, url: listing.url, pay: pay ?? undefined, neighborhood: listing.neighborhood, source: "listing", savedAt: Date.now() }); setSaved(true); }
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className={`row-heart save-heart ${saved ? "save-heart--on" : ""}`}
      aria-label={saved ? "Unsave" : "Save"}
      aria-pressed={saved}
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s-7-4.4-9.3-9.1C1 9 2.5 5 6.4 5c2 0 3.4 1.1 4.6 2.6h2C14.2 6.1 15.6 5 17.6 5c3.9 0 5.4 4 3.7 6.9C19 16.6 12 21 12 21z" />
      </svg>
    </button>
  );
}

// Pull the pay range out of the title or snippet — covers most Craigslist patterns
function extractPay(...sources: (string | undefined)[]): string | null {
  const text = sources.filter(Boolean).join(" ");
  // $20-25/hr, $20-25 per hour, $20/hr, $20 hr, $25 an hour
  const re = /\$\s*\d+(?:\.\d+)?(?:\s*[-–—to]+\s*\$?\s*\d+(?:\.\d+)?)?(?:\s*(?:\/|per|an?)\s*(?:hr|hour))?/i;
  const m = text.match(re);
  if (!m) return null;
  return m[0]
    .replace(/\s*(\/|per|an?)\s*(hr|hour)/i, "/hr")
    .replace(/\s*[-–—to]+\s*/i, "–")
    .replace(/\s+/g, "")
    .replace(/–/g, "–");
}

// Extract a short shift tag from title/snippet
function extractShift(...sources: (string | undefined)[]): string | null {
  const text = sources.filter(Boolean).join(" ").toLowerCase();
  if (/\bfull[-\s]?time\b/.test(text))    return "Full-time";
  if (/\bpart[-\s]?time\b/.test(text))    return "Part-time";
  if (/\bweekends?\b/.test(text))         return "Weekends";
  if (/\bevenings?\b|\bnights?\b/.test(text)) return "Nights";
  if (/\bseasonal\b/.test(text))          return "Seasonal";
  return null;
}

const CITY_KEY = "shiftai:listings:city";
const QUERY_KEY = "shiftai:listings:query";

export default function ListingsDrawer({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (listing: Listing) => void;
}) {
  const [city, setCity]     = useState("newyork");
  const [query, setQuery]   = useState("bartender");
  const [listings, setList] = useState<Listing[]>([]);
  const [loading, setLoad]  = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const dragRef = useRef<{ startX: number; startT: number; dragging: boolean; delta: number }>({
    startX: 0, startT: 0, dragging: false, delta: 0,
  });

  // Load saved prefs on first open
  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedCity = localStorage.getItem(CITY_KEY);
    const savedQ    = localStorage.getItem(QUERY_KEY);
    if (savedCity) setCity(savedCity);
    if (savedQ)    setQuery(savedQ);
  }, []);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Fetch whenever open+city+query change
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const ac = new AbortController();
    setLoad(true);
    setError(null);
    localStorage.setItem(CITY_KEY, city);
    localStorage.setItem(QUERY_KEY, query);
    fetch(`/api/listings?city=${encodeURIComponent(city)}&q=${encodeURIComponent(query)}&limit=40`, {
      signal: ac.signal,
    })
      .then((r) => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))
      .then((j: { listings?: Listing[]; error?: string }) => {
        if (cancelled) return;
        if (j.error) {
          setError(j.error);
          setList([]);
        } else {
          setList(j.listings || []);
        }
      })
      .catch((err) => {
        if (cancelled || (err instanceof Error && err.name === "AbortError")) return;
        setError("Couldn't reach Craigslist. Try again in a minute.");
        setList([]);
      })
      .finally(() => { if (!cancelled) setLoad(false); });
    return () => { cancelled = true; ac.abort(); };
  }, [open, city, query]);

  if (!open) return null;

  const cityLabel = CITIES.find((c) => c.id === city)?.label || city;

  // ── Drag-to-dismiss (swipe left) ─────────────────────
  const applyDrag = (delta: number) => {
    const el = drawerRef.current;
    if (!el) return;
    const clamped = Math.min(0, delta); // only leftward
    const drag = clamped > 0 ? clamped * 0.3 : clamped;
    el.style.transform = `translateX(${drag}px)`;
    el.style.transition = "none";
  };
  const settleDrag = (shouldClose: boolean) => {
    const el = drawerRef.current;
    if (!el) return;
    el.style.transition = "transform 320ms cubic-bezier(0.32, 0.72, 0, 1)";
    if (shouldClose) {
      el.style.transform = "translateX(-100%)";
      setTimeout(onClose, 280);
    } else {
      el.style.transform = "translateX(0)";
    }
  };
  const onDragStart = (e: React.PointerEvent) => {
    dragRef.current = { startX: e.clientX, startT: Date.now(), dragging: true, delta: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.delta = e.clientX - d.startX;
    applyDrag(d.delta);
  };
  const onDragEnd = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d.dragging) return;
    d.dragging = false;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    const dtMs = Math.max(50, Date.now() - d.startT);
    const velocity = d.delta / dtMs; // px/ms (negative when swiping left)
    const shouldClose = d.delta < -120 || (d.delta < -40 && velocity < -0.6);
    settleDrag(shouldClose);
  };

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside ref={drawerRef} className="drawer" role="dialog" aria-label="Live listings">
        {/* Header — also a drag handle */}
        <header
          className="flex items-center justify-between px-5 pt-5 pb-4"
          style={{ borderBottom: "1px solid var(--hairline)", touchAction: "pan-y" }}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <div className="min-w-0">
            <p className="tag">Live · Manhattan FOH</p>
            <p className="title-2 mt-1" style={{ fontFamily: "var(--font-display-stack)", fontWeight: 500, fontSize: 24, letterSpacing: "-0.028em" }}>
              {cityLabel}
            </p>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-full"
            style={{
              background: "var(--lg-bg-thick)",
              backdropFilter: "blur(14px) saturate(180%)",
              WebkitBackdropFilter: "blur(14px) saturate(180%)",
              border: "1px solid var(--lg-border)",
              color: "var(--ink)",
              touchAction: "manipulation",
              boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85)",
            }}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        {/* Query chips */}
        <div className="px-5 pt-4 pb-3 flex gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {QUERIES.map((q) => (
            <button
              key={q}
              onClick={() => setQuery(q)}
              className="action-chip"
              style={
                q === query
                  ? { background: "var(--ink)", color: "#FFFFFF", borderColor: "var(--ink)" }
                  : undefined
              }
            >
              {q}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="drawer__list">
          {loading && (
            <div className="px-5 py-8 text-center">
              <span className="spinner mx-auto block" />
              <p className="meta mt-3">Fetching from Craigslist…</p>
            </div>
          )}

          {!loading && error && (
            <div className="px-5 py-8">
              <p className="body" style={{ color: "var(--ink)", fontWeight: 600 }}>{error}</p>
              <p className="meta mt-1">
                Craigslist blocks automated requests sometimes. Retry in a moment.
              </p>
            </div>
          )}

          {!loading && !error && listings.length === 0 && (
            <div className="px-5 py-12 text-center">
              <p className="title">No listings found</p>
              <p className="muted mt-2 max-w-[28ch] mx-auto">
                Try a different city or search term.
              </p>
            </div>
          )}

          {!loading && !error && listings.length > 0 && (
            <ul className="pb-8">
              {listings.map((l) => {
                const pay   = extractPay(l.title, l.snippet);
                const shift = extractShift(l.title, l.snippet);
                const isFresh = Date.now() - l.postedAt < 60 * 60_000; // < 1h
                return (
                  <li key={l.id} className="listing-li">
                    <button
                      onClick={() => onPick(l)}
                      className="listing-row"
                    >
                      {/* Top: title + time */}
                      <div className="listing-row__top">
                        <h3 className="listing-row__title">
                          {l.title}
                        </h3>
                        <span className="listing-row__time">
                          {isFresh && <span className="listing-row__fresh" aria-label="New" />}
                          {relTime(l.postedAt)}
                        </span>
                      </div>

                      {/* Middle: pay + neighborhood + shift */}
                      <div className="listing-row__meta">
                        {pay && (
                          <span className="listing-pill listing-pill--pay">
                            {pay}
                          </span>
                        )}
                        {l.neighborhood && (
                          <span className="listing-pill listing-pill--loc">
                            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2C8 2 5 5 5 9c0 5 7 13 7 13s7-8 7-13c0-4-3-7-7-7z" />
                              <circle cx="12" cy="9" r="2.5" />
                            </svg>
                            {l.neighborhood}
                          </span>
                        )}
                        {shift && (
                          <span className="listing-pill">
                            {shift}
                          </span>
                        )}
                      </div>

                      {/* Bottom: snippet — only if there's one */}
                      {l.snippet && (
                        <p className="listing-row__snippet">
                          {l.snippet}
                        </p>
                      )}
                    </button>
                    <RowHeart listing={l} pay={pay} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer credit */}
        <footer
          className="px-5 py-3 flex items-center justify-between"
          style={{ borderTop: "1px solid var(--hairline)", background: "rgba(255,255,255,0.35)" }}
        >
          <p className="caption" style={{ color: "var(--ink-3)" }}>
            Live from Craigslist · updated every 10 min
          </p>
          <button
            onClick={() => {
              // force refresh
              setCity((c) => c);
              setQuery((q) => q);
            }}
            className="caption"
            style={{ color: "var(--ink)", fontWeight: 600, touchAction: "manipulation" }}
          >
            Refresh
          </button>
        </footer>
      </aside>
    </>
  );
}
