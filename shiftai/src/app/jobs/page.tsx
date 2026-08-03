"use client";

/**
 * Jobs — verified Craigslist Manhattan bartender listings.
 * Ported from the old home screen, restyled iOS. Each listing gets
 * "Prep this job" → /?url=<listing url> which auto-runs the agent crew.
 */

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Check,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { VerifiedListing } from "@/src/lib/craigslist";
import { trackEvent } from "@/src/lib/track";

import NavBar from "@/src/components/ios/NavBar";
import Card from "@/src/components/ios/Card";
import PillButton from "@/src/components/ios/PillButton";

interface ApiResp {
  ok: boolean;
  fetchedAt?: string;
  ageMs?: number | null;
  totalIndexed?: number;
  totalReal?: number;
  totalScams?: number;
  listings?: VerifiedListing[];
  error?: string;
}

export default function JobsPage() {
  const router = useRouter();

  const [data, setData] = useState<ApiResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/listings", { cache: "no-store" });
      const j = (await res.json()) as ApiResp;
      if (!j.ok) throw new Error(j.error ?? "load failed");
      setData(j);
      trackEvent("listings_loaded", {
        total: j.totalReal ?? 0,
        scams: j.totalScams ?? 0,
        cached: (j.ageMs ?? 0) > 5000,
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const listings = data?.listings ?? [];

  const prepJob = useCallback(
    (listing: VerifiedListing) => {
      trackEvent("listing_prep", { post_id: listing.postId });
      router.push("/?url=" + encodeURIComponent(listing.url));
    },
    [router],
  );

  return (
    <main style={{ paddingBottom: 96 }}>
      <NavBar
        title="Jobs"
        large
        right={
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Refresh listings"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 44,
              height: 44,
              border: "none",
              background: "transparent",
              color: "#007AFF",
              cursor: "pointer",
            }}
          >
            <RefreshCw size={19} strokeWidth={2.2} />
          </button>
        }
      />

      <section style={{ padding: "0 16px" }}>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.4,
            color: "var(--sys-gray, #8E8E93)",
            margin: "4px 4px 10px",
          }}
        >
          Real walk-in bartender openings, pulled live from Craigslist Manhattan. Scams
          filtered out — every one has an address, a walk-in time, or a real venue.
        </p>
        <MetaRow loading={loading} data={data} err={err} />
      </section>

      <section style={{ padding: "12px 16px 0", display: "flex", flexDirection: "column", gap: 14 }}>
        {loading && !data ? <FirstLoad /> : null}

        {err ? (
          <Card>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px", color: "#FF3B30" }}>
              Couldn&rsquo;t fetch listings
            </h3>
            <p style={{ fontSize: 15, margin: "0 0 12px", color: "var(--sys-gray, #8E8E93)" }}>{err}</p>
            <PillButton onPress={() => void load()} variant="tinted">
              Try again
            </PillButton>
          </Card>
        ) : null}

        {!loading && !err && listings.length === 0 ? (
          <Card>
            <p style={{ fontSize: 16, fontWeight: 600, margin: "0 0 4px" }}>
              No verified bartender listings in this hour.
            </p>
            <p style={{ fontSize: 14, margin: 0, color: "var(--sys-gray, #8E8E93)" }}>
              Hit refresh in 20 minutes — we re-scrape Craigslist hourly.
            </p>
          </Card>
        ) : null}

        {listings.map((l) => (
          <ListingCard key={l.postId} listing={l} onPrep={() => prepJob(l)} />
        ))}
      </section>

      <footer
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 6,
          padding: "20px 24px 8px",
          fontSize: 12,
          lineHeight: 1.45,
          color: "var(--sys-gray, #8E8E93)",
        }}
      >
        <ShieldCheck size={13} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} />
        <span>
          Source: Craigslist Manhattan food/bev/hospitality. AI scam filter blocks: fee asks,
          ID/bank requests, off-platform redirects, unrealistic pay.
        </span>
      </footer>

    </main>
  );
}

/* ── meta row ────────────────────────────────────── */

function MetaRow({
  loading,
  data,
  err,
}: {
  loading: boolean;
  data: ApiResp | null;
  err: string | null;
}) {
  if (err) return null;
  const base: CSSProperties = {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    fontSize: 13,
    color: "var(--sys-gray, #8E8E93)",
    margin: "0 4px",
  };
  if (!data) {
    return (
      <p style={base}>
        <Loader2 size={12} strokeWidth={2.2} style={{ animation: "spin 1s linear infinite" }} />
        <span>{loading ? "Pulling latest from Craigslist…" : ""}</span>
      </p>
    );
  }
  const ageMin = Math.max(1, Math.round((data.ageMs ?? 0) / 60000));
  const refreshedLabel = (data.ageMs ?? 0) < 5000 ? "just now" : `${ageMin} min ago`;
  return (
    <p style={base}>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          padding: "3px 8px",
          borderRadius: 999,
          background: "rgba(52,199,89,0.14)",
          color: "#248A3D",
          fontWeight: 600,
        }}
      >
        <Check size={12} strokeWidth={3} />
        {data.totalReal ?? 0} verified
      </span>
      <span>·</span>
      <span>
        {data.totalScams ?? 0} scam{(data.totalScams ?? 0) === 1 ? "" : "s"} filtered out
      </span>
      <span>·</span>
      <span>refreshed {refreshedLabel}</span>
    </p>
  );
}

/* ── listing card ────────────────────────────────── */

function ListingCard({
  listing,
  onPrep,
}: {
  listing: VerifiedListing;
  onPrep: () => void;
}) {
  const headingText = listing.venueName || listing.title || "Manhattan venue";
  const sub: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
    color: "var(--sys-gray, #8E8E93)",
    margin: "0 0 4px",
  };
  return (
    <Card>
      <header
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 10,
          marginBottom: 6,
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>
          {headingText}
        </h3>
        {listing.payHint ? (
          <span style={{ fontSize: 14, fontWeight: 600, color: "#248A3D", whiteSpace: "nowrap" }}>
            {listing.payHint}
          </span>
        ) : null}
      </header>

      {listing.address ? (
        <p style={sub}>
          <MapPin size={14} strokeWidth={2} style={{ flexShrink: 0 }} />
          <span>
            {listing.address}
            {listing.neighborhood ? ` · ${listing.neighborhood}` : ""}
          </span>
        </p>
      ) : null}

      {listing.walkInWindow ? (
        <p style={{ ...sub, color: "#007AFF", fontWeight: 600 }}>
          <Clock size={14} strokeWidth={2.2} style={{ flexShrink: 0 }} />
          <span>{listing.walkInWindow}</span>
        </p>
      ) : null}

      <p style={{ fontSize: 15, lineHeight: 1.45, margin: "8px 0" }}>{listing.bodyExcerpt}</p>

      {listing.whatToBring ? (
        <p style={{ fontSize: 13, margin: "0 0 8px", color: "var(--sys-gray, #8E8E93)" }}>
          Bring: {listing.whatToBring}
        </p>
      ) : null}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
        <PillButton onPress={onPrep} variant="filled">
          <Sparkles size={15} strokeWidth={2.2} style={{ marginRight: 5, verticalAlign: -2 }} />
          Prep this job
        </PillButton>
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackEvent("listing_click", { post_id: listing.postId })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            fontSize: 14,
            fontWeight: 600,
            color: "#007AFF",
            textDecoration: "none",
            padding: "8px 4px",
          }}
        >
          View on Craigslist
          <ArrowUpRight size={14} strokeWidth={2.4} />
        </a>
      </div>
    </Card>
  );
}

/* ── first load (cold scrape can take 15-30s) ────── */

function FirstLoad() {
  const row: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 15,
    padding: "6px 0",
  };
  return (
    <Card>
      <div style={{ ...row, fontWeight: 600 }}>
        <Loader2
          size={16}
          strokeWidth={2.4}
          color="#007AFF"
          style={{ animation: "spin 1s linear infinite" }}
        />
        <span>Pulling Manhattan bartender posts from Craigslist</span>
      </div>
      <div style={{ ...row, color: "var(--sys-gray, #8E8E93)" }}>
        <span style={{ width: 16 }} />
        <span>Filtering scams</span>
      </div>
      <div style={{ ...row, color: "var(--sys-gray, #8E8E93)" }}>
        <span style={{ width: 16 }} />
        <span>Extracting addresses + walk-in times</span>
      </div>
      <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--sys-gray, #8E8E93)" }}>
        First load takes ~30s. Cached after that.
      </p>
    </Card>
  );
}

