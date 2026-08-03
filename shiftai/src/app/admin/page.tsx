"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type Event = {
  name: string;
  props: Record<string, unknown>;
  ts: number;
  ua?: string;
  ip?: string;
  country?: string;
  city?: string;
};

type ApiResponse = {
  storage: string;
  count: number;
  events: Event[];
};

const TOKEN_KEY = "shiftai:admin-token";

export default function AdminDashboard() {
  const [token, setToken] = useState<string>("");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const stored = window.localStorage.getItem(TOKEN_KEY);
    const urlKey = new URLSearchParams(window.location.search).get("key");
    const initial = urlKey || stored || "";
    if (initial) setToken(initial);
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events?limit=1000`, {
        headers: { "x-admin-token": token },
      });
      if (res.status === 401) {
        setError("Unauthorized — wrong token or ADMIN_TOKEN not set in Vercel env.");
        setData(null);
        return;
      }
      if (!res.ok) {
        setError(`Error ${res.status}`);
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    void load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, [token, load]);

  const counts = useMemo(() => {
    const byName = new Map<string, number>();
    const byCountry = new Map<string, number>();
    const byPath = new Map<string, number>();
    const sessions = new Set<string>();
    for (const e of data?.events ?? []) {
      byName.set(e.name, (byName.get(e.name) ?? 0) + 1);
      if (e.country) byCountry.set(e.country, (byCountry.get(e.country) ?? 0) + 1);
      const path = typeof e.props?.path === "string" ? e.props.path : "unknown";
      byPath.set(path, (byPath.get(path) ?? 0) + 1);
      const sid = typeof e.props?.session === "string" ? e.props.session : null;
      if (sid) sessions.add(sid);
    }
    return {
      total: data?.events.length ?? 0,
      sessions: sessions.size,
      byName: [...byName.entries()].sort((a, b) => b[1] - a[1]),
      byCountry: [...byCountry.entries()].sort((a, b) => b[1] - a[1]),
      byPath: [...byPath.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [data]);

  const filtered = useMemo(() => {
    const evts = data?.events ?? [];
    if (filter === "all") return evts;
    return evts.filter((e) => e.name === filter);
  }, [data, filter]);

  return (
    <div className="admin-shell">
      <header className="admin-head">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="page-title">Tracking dashboard</h1>
          <p className="support-text">
            Every page view, chat send, profile save, and link tap on ShiftAI. Updates every 15s.
          </p>
        </div>
        {data ? (
          <div className="admin-meta">
            <span className="status-pill status-pill--on">
              <span className="status-dot" /> storage: {data.storage}
            </span>
            <span className="admin-meta__stat">
              <strong>{counts.total}</strong> events
            </span>
            <span className="admin-meta__stat">
              <strong>{counts.sessions}</strong> sessions
            </span>
          </div>
        ) : null}
      </header>

      <section className="admin-auth">
        <input
          className="input"
          type="password"
          placeholder="Admin token (set ADMIN_TOKEN in Vercel env)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
        />
        <button type="button" className="primary-btn" onClick={load} disabled={loading || !token}>
          {loading ? "Loading…" : "Load events"}
        </button>
      </section>

      {error ? <div className="admin-error">{error}</div> : null}

      {data ? (
        <>
          <section className="admin-grid">
            <StatBlock title="Events by name" rows={counts.byName} onClick={(k) => setFilter(k)} active={filter} />
            <StatBlock title="Traffic by path" rows={counts.byPath} />
            <StatBlock title="Country" rows={counts.byCountry} />
          </section>

          <section className="admin-filters">
            <button
              type="button"
              className={`filter-pill ${filter === "all" ? "filter-pill--active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All events
            </button>
            {counts.byName.slice(0, 8).map(([name, n]) => (
              <button
                key={name}
                type="button"
                className={`filter-pill ${filter === name ? "filter-pill--active" : ""}`}
                onClick={() => setFilter(name)}
              >
                {name} <span className="filter-pill__time">{n}</span>
              </button>
            ))}
          </section>

          <section className="admin-feed">
            {filtered.length === 0 ? (
              <p className="empty-kicker">No events yet.</p>
            ) : (
              filtered.map((e, i) => (
                <article key={`${e.ts}-${i}`} className="admin-row">
                  <div className="admin-row__head">
                    <code className="code-chip">{e.name}</code>
                    <span className="admin-row__time">{new Date(e.ts).toLocaleString()}</span>
                    {e.country ? <span className="admin-row__geo">{e.country}{e.city ? ` · ${e.city}` : ""}</span> : null}
                    {e.ip ? <span className="admin-row__geo">{e.ip}</span> : null}
                  </div>
                  <pre className="admin-row__props">{JSON.stringify(e.props, null, 2)}</pre>
                </article>
              ))
            )}
          </section>
        </>
      ) : null}

      {!data && !error && token ? <p className="support-text">Loading…</p> : null}
      {data?.storage === "none" ? (
        <div className="admin-hint">
          <strong>Storage: none.</strong> Events still fire into Vercel Web Analytics (visible in
          vercel.com dashboard) and runtime logs. To see them here, add{" "}
          <code>UPSTASH_REDIS_REST_URL</code> and <code>UPSTASH_REDIS_REST_TOKEN</code> env vars in
          Vercel → free Redis at upstash.com.
        </div>
      ) : null}
    </div>
  );
}

function StatBlock({
  title,
  rows,
  onClick,
  active,
}: {
  title: string;
  rows: [string, number][];
  onClick?: (k: string) => void;
  active?: string;
}) {
  return (
    <div className="glass-card admin-stat">
      <span className="eyebrow">{title}</span>
      {rows.length === 0 ? (
        <p className="support-text">—</p>
      ) : (
        <ul className="admin-stat__list">
          {rows.slice(0, 10).map(([k, n]) => (
            <li
              key={k}
              className={`admin-stat__row${onClick ? " admin-stat__row--clickable" : ""}${
                active === k ? " admin-stat__row--active" : ""
              }`}
              onClick={() => onClick?.(k)}
            >
              <span>{k}</span>
              <strong>{n}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
