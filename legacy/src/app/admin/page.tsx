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
    <div className="fade-in px-5 max-w-4xl mx-auto">
      <div className="pt-6 pb-4">
        <p className="label mb-1">Admin</p>
        <h1 className="display">Tracking</h1>
        <p
          className="mt-2 text-sm leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          Live events from visitors: page views, job analyses, resume downloads, interviews.
          Refreshes every 15s.
        </p>
      </div>

      <div className="mt-2 mb-6 flex gap-2">
        <input
          type="password"
          className="input-field flex-1"
          placeholder="Admin token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
        />
        <button
          type="button"
          onClick={load}
          disabled={loading || !token}
          className="btn-primary flex-shrink-0"
          style={{ width: "auto", paddingLeft: 16, paddingRight: 16 }}
        >
          {loading ? "…" : "Load"}
        </button>
      </div>

      {error && (
        <div
          className="mb-4 p-3 rounded-lg text-sm"
          style={{ background: "var(--danger-dim)", color: "var(--danger)" }}
        >
          {error}
        </div>
      )}

      {data && (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            <Stat label="Storage" value={data.storage} />
            <Stat label="Events" value={String(counts.total)} />
            <Stat label="Sessions" value={String(counts.sessions)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
            <StatBlock
              title="Events by name"
              rows={counts.byName}
              onRowClick={(k) => setFilter(k)}
              active={filter}
            />
            <StatBlock title="Traffic by path" rows={counts.byPath} />
            <StatBlock title="Country" rows={counts.byCountry} />
          </div>

          <div className="flex gap-1.5 flex-wrap mb-4">
            <button
              type="button"
              className="badge"
              style={filter === "all" ? { background: "var(--accent-dim)", color: "var(--accent-text)" } : {}}
              onClick={() => setFilter("all")}
            >
              All ({counts.total})
            </button>
            {counts.byName.slice(0, 10).map(([name, n]) => (
              <button
                key={name}
                type="button"
                className="badge"
                style={filter === name ? { background: "var(--accent-dim)", color: "var(--accent-text)" } : {}}
                onClick={() => setFilter(name)}
              >
                {name} ({n})
              </button>
            ))}
          </div>

          <div className="space-y-2 pb-8">
            {filtered.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
                No events yet.
              </p>
            ) : (
              filtered.map((e, i) => (
                <div
                  key={`${e.ts}-${i}`}
                  className="p-3 rounded-lg"
                  style={{ background: "var(--surface)" }}
                >
                  <div className="flex flex-wrap gap-2 items-center mb-1.5">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ background: "var(--accent-dim)", color: "var(--accent-text)" }}
                    >
                      {e.name}
                    </span>
                    <span className="text-xs tabular-nums" style={{ color: "var(--text-tertiary)" }}>
                      {new Date(e.ts).toLocaleString()}
                    </span>
                    {e.country && (
                      <span className="badge">
                        {e.country}
                        {e.city ? ` · ${e.city}` : ""}
                      </span>
                    )}
                    {e.ip && (
                      <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
                        {e.ip}
                      </span>
                    )}
                  </div>
                  <pre
                    className="text-xs font-mono whitespace-pre-wrap overflow-x-auto"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {JSON.stringify(e.props, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {data?.storage === "none" && (
        <div
          className="mt-2 p-3 rounded-lg text-xs leading-relaxed"
          style={{ background: "var(--surface)", color: "var(--text-secondary)" }}
        >
          <strong>Storage: none.</strong> Events fire into Vercel Web Analytics (
          <a
            href="https://vercel.com/hergis-projects-cfb9fc99/shiftai/analytics"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--accent)" }}
          >
            dashboard
          </a>
          ) and runtime logs. For this in-app view, set{" "}
          <code
            className="px-1 rounded"
            style={{ background: "var(--border)" }}
          >
            UPSTASH_REDIS_REST_URL
          </code>{" "}
          +{" "}
          <code
            className="px-1 rounded"
            style={{ background: "var(--border)" }}
          >
            UPSTASH_REDIS_REST_TOKEN
          </code>{" "}
          in Vercel env (free at upstash.com).
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg" style={{ background: "var(--surface)" }}>
      <p className="label">{label}</p>
      <p className="text-2xl font-bold tabular-nums" style={{ color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}

function StatBlock({
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
    <div className="p-3 rounded-lg" style={{ background: "var(--surface)" }}>
      <p className="label mb-2">{title}</p>
      {rows.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
          —
        </p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 10).map(([k, n]) => (
            <li
              key={k}
              onClick={() => onRowClick?.(k)}
              className="flex justify-between text-xs py-1 px-1.5 rounded"
              style={{
                color: "var(--text-secondary)",
                cursor: onRowClick ? "pointer" : "default",
                background: active === k ? "var(--accent-dim)" : "transparent",
              }}
            >
              <span className="truncate pr-2">{k}</span>
              <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                {n}
              </strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
