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
        setError("Unauthorized — check ADMIN_TOKEN in Vercel env.");
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
      byName:    [...byName.entries()].sort((a, b) => b[1] - a[1]),
      byCountry: [...byCountry.entries()].sort((a, b) => b[1] - a[1]),
      byPath:    [...byPath.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [data]);

  const filtered = useMemo(() => {
    const evts = data?.events ?? [];
    if (filter === "all") return evts;
    return evts.filter((e) => e.name === filter);
  }, [data, filter]);

  return (
    <div className="fade-in px-4 max-w-[900px] mx-auto pb-4">
      <header className="pt-3 pb-4">
        <p className="label">Admin</p>
        <h1 className="display">Tracking</h1>
        <p className="subhead mt-2" style={{ color: "var(--ios-label-secondary)" }}>
          Live events from visitors. Refreshes every 15 s.
        </p>
      </header>

      {/* Token input (hidden once loaded) */}
      {!data && (
        <div className="ios-group mb-4">
          <div className="px-4 py-2.5">
            <label className="footnote block mb-1" style={{ color: "var(--ios-label-secondary)" }}>
              Admin token
            </label>
            <input
              type="password"
              className="w-full bg-transparent border-none outline-none body p-0"
              placeholder="Paste token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void load();
              }}
              style={{ color: "var(--ios-label)" }}
            />
          </div>
        </div>
      )}
      {!data && (
        <button
          onClick={load}
          disabled={loading || !token}
          className="btn-primary pulse-press mb-4"
        >
          {loading ? "…" : "Load events"}
        </button>
      )}

      {error && (
        <div
          className="mb-4 p-4 rounded-[14px] subhead"
          style={{ background: "var(--danger-dim)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <Kpi label="Storage"  value={data.storage} />
            <Kpi label="Events"   value={String(counts.total)} />
            <Kpi label="Sessions" value={String(counts.sessions)} />
          </div>

          {/* Breakdowns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <Breakdown
              title="Events"
              rows={counts.byName}
              onRowClick={(k) => setFilter(k)}
              active={filter}
            />
            <Breakdown title="Paths"   rows={counts.byPath} />
            <Breakdown title="Country" rows={counts.byCountry} />
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 flex-wrap mb-4 px-1">
            <button
              type="button"
              className="badge pulse-press"
              style={
                filter === "all"
                  ? { background: "var(--accent-dim)", color: "var(--accent-text)" }
                  : undefined
              }
              onClick={() => setFilter("all")}
            >
              All ({counts.total})
            </button>
            {counts.byName.slice(0, 10).map(([name, n]) => (
              <button
                key={name}
                type="button"
                className="badge pulse-press"
                style={
                  filter === name
                    ? { background: "var(--accent-dim)", color: "var(--accent-text)" }
                    : undefined
                }
                onClick={() => setFilter(name)}
              >
                {name} ({n})
              </button>
            ))}
          </div>

          {/* Event feed */}
          <h3 className="ios-group-header">Feed</h3>
          <div className="ios-group mb-6">
            {filtered.length === 0 ? (
              <div className="p-6 text-center">
                <p className="subhead" style={{ color: "var(--ios-label-tertiary)" }}>
                  No events yet.
                </p>
              </div>
            ) : (
              filtered.map((e, i) => (
                <div
                  key={`${e.ts}-${i}`}
                  className="p-4"
                  style={
                    i > 0
                      ? { borderTop: "0.5px solid var(--ios-separator)" }
                      : undefined
                  }
                >
                  <div className="flex flex-wrap gap-2 items-center mb-2">
                    <span
                      className="badge"
                      style={{ background: "var(--accent-dim)", color: "var(--accent-text)", fontWeight: 600 }}
                    >
                      {e.name}
                    </span>
                    <span
                      className="footnote tabular-nums"
                      style={{ color: "var(--ios-label-tertiary)" }}
                    >
                      {new Date(e.ts).toLocaleString()}
                    </span>
                    {e.country && (
                      <span className="badge">
                        {e.country}
                        {e.city ? ` · ${e.city}` : ""}
                      </span>
                    )}
                  </div>
                  <pre
                    className="caption font-mono whitespace-pre-wrap overflow-x-auto"
                    style={{ color: "var(--ios-label-secondary)" }}
                  >
                    {JSON.stringify(e.props, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>

          {data.storage === "none" && (
            <div
              className="p-4 rounded-[14px] footnote"
              style={{ background: "var(--ios-gray-6)", color: "var(--ios-label-secondary)" }}
            >
              <strong style={{ color: "var(--ios-label)" }}>Storage: none.</strong>{" "}
              Events fire into Vercel Web Analytics and runtime logs. To persist
              them in this dashboard, set{" "}
              <code
                className="px-1 rounded"
                style={{ background: "rgba(60,60,67,0.08)" }}
              >
                UPSTASH_REDIS_REST_URL
              </code>{" "}
              +{" "}
              <code
                className="px-1 rounded"
                style={{ background: "rgba(60,60,67,0.08)" }}
              >
                UPSTASH_REDIS_REST_TOKEN
              </code>{" "}
              in Vercel env (free at upstash.com).
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="p-3 rounded-[14px]"
      style={{
        background: "#fff",
        boxShadow: "0 1px 2px rgba(15,23,42,0.04), inset 0 1px 0 rgba(255,255,255,0.9)",
      }}
    >
      <p className="caption uppercase tracking-wider" style={{ color: "var(--ios-label-secondary)", fontWeight: 600 }}>
        {label}
      </p>
      <p className="title-2 tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  onRowClick,
  active,
}: {
  title: string;
  rows: [string, number][];
  onRowClick?: (k: string) => void;
  active?: string;
}) {
  return (
    <div>
      <h3 className="ios-group-header">{title}</h3>
      <div className="ios-group">
        {rows.length === 0 ? (
          <div className="p-4">
            <p className="footnote" style={{ color: "var(--ios-label-tertiary)" }}>—</p>
          </div>
        ) : (
          rows.slice(0, 10).map(([k, n], idx) => (
            <button
              key={k}
              onClick={() => onRowClick?.(k)}
              className="ios-row"
              style={{
                cursor: onRowClick ? "pointer" : "default",
                background: active === k ? "var(--accent-dim)" : "transparent",
                ...(idx > 0
                  ? { borderTop: "0.5px solid var(--ios-separator)" }
                  : {}),
              }}
            >
              <span className="ios-row__body body truncate">{k}</span>
              <span className="tabular-nums" style={{ color: "var(--ios-label-secondary)", fontWeight: 600 }}>
                {n}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
