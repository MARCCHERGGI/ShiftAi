"use client";

/**
 * Prep — the home screen.
 * Paste a job link (or the listing text) → 6-agent crew researches the venue
 * live → venue card, intel groups, synthesis with fit score + walk-in plan.
 */

import {
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Beer,
  BookOpen,
  ConciergeBell,
  FileText,
  Hotel,
  Link2,
  Martini,
  MessageCircle,
  Mic,
  Search,
  Sun,
  ThumbsDown,
  ThumbsUp,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import type {
  AgentKey,
  AgentStatus,
  AnalyzeResult,
  CrewEvent,
  MenuIntel,
  PeopleIntel,
  ReviewIntel,
  Synthesis,
  VenueIntel,
} from "@/src/lib/agents/types";
import { runCrew } from "@/src/lib/agents/client";
import { loadAnalysis, saveAnalysis } from "@/src/lib/store";
import { trackEvent } from "@/src/lib/track";

import NavBar from "@/src/components/ios/NavBar";
import Card from "@/src/components/ios/Card";
import InsetGroup from "@/src/components/ios/InsetGroup";
import Row from "@/src/components/ios/Row";
import PillButton from "@/src/components/ios/PillButton";
import TextField from "@/src/components/ios/TextField";
import SegmentedControl from "@/src/components/ios/SegmentedControl";
import CrewProgress from "@/src/components/ios/CrewProgress";
import ScoreRing from "@/src/components/ios/ScoreRing";
import InstallCoach from "@/src/components/ios/InstallCoach";

/* ── crew step definitions ───────────────────────── */

const AGENT_STEPS: { key: AgentKey; label: string }[] = [
  { key: "scout", label: "Scout - reads the listing" },
  { key: "venue", label: "Venue - identifies the spot" },
  { key: "menu", label: "Menu - studies the menu" },
  { key: "people", label: "People - checks the operators" },
  { key: "reviews", label: "Reviews - reads the room" },
  { key: "synthesis", label: "Synthesis - builds your play" },
];

type StatusMap = Record<AgentKey, AgentStatus>;

function freshStatuses(): StatusMap {
  return {
    scout: "idle",
    venue: "idle",
    menu: "idle",
    people: "idle",
    reviews: "idle",
    synthesis: "idle",
  };
}

const MODES = ["Link", "Paste text"];

/* Venue-type examples — tapping one fills a realistic sample listing. */
const SAMPLES: { label: string; icon: ReactNode; text: string }[] = [
  {
    label: "Cocktail bar",
    icon: <Martini size={15} strokeWidth={2} />,
    text: "Bartender wanted — craft cocktail bar, East Village. High-volume weekend shifts, 2+ years cocktail experience. Knowledge of classics + batching required. Walk-ins Tue-Thu 2-4pm at 1st Ave & E 7th St. $12/hr + tips, averages $45-60/hr all-in.",
  },
  {
    label: "Rooftop",
    icon: <Sun size={15} strokeWidth={2} />,
    text: "Rooftop lounge in Midtown hiring bartenders for the season. Bottle service + frozen program, 300+ cover nights. TIPS certified required. Stop by Mon 3-5pm, W 40th St entrance, ask for the beverage director.",
  },
  {
    label: "Dive bar",
    icon: <Beer size={15} strokeWidth={2} />,
    text: "Neighborhood dive on the Lower East Side needs a night bartender. Shot-and-beer crowd, jukebox, cash-heavy. No cocktail list — fast hands and thick skin. Two shifts to start. Come by after 8pm, ask for Danny.",
  },
  {
    label: "Hotel bar",
    icon: <Hotel size={15} strokeWidth={2} />,
    text: "SoHo boutique hotel seeks lobby bar bartender. Classic cocktails, wine knowledge, hospitality-first service. Union position, benefits after 90 days. Apply in person weekdays 10am-12pm, HR entrance on Crosby St.",
  },
];

/* ── page (Suspense boundary for useSearchParams — Next 15) ── */

export default function PrepPage() {
  return (
    <Suspense fallback={null}>
      <PrepScreen />
    </Suspense>
  );
}

function PrepScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<string>(MODES[0]);
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");

  const [running, setRunning] = useState(false);
  const [statuses, setStatuses] = useState<StatusMap>(freshStatuses);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [saved, setSaved] = useState<AnalyzeResult | null>(null);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Surface the last analysis as a compact "Recent" card in the idle state
  // (Resume / Interview flows stay warm off localStorage regardless).
  useEffect(() => {
    setSaved(loadAnalysis());
  }, []);

  const handleEvent = useCallback((e: CrewEvent) => {
    if (e.agent === "crew") return;
    const agent = e.agent;
    setStatuses((prev) => ({
      ...prev,
      [agent]: e.status === "start" ? "running" : e.status === "done" ? "done" : "error",
    }));
  }, []);

  const run = useCallback(
    async (input: { url?: string; text?: string }) => {
      setRunning(true);
      setResult(null);
      setRestored(false);
      setError(null);
      setStatuses(freshStatuses());
      trackEvent("crew_start", { mode: input.url ? "link" : "text" });
      try {
        const analysis = await runCrew(input, handleEvent);
        saveAnalysis(analysis);
        setResult(analysis);
        setSaved(analysis);
        trackEvent("crew_complete", {
          fit: analysis.synthesis.fitScore,
          venue: analysis.venue?.name ?? null,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "The crew hit a wall.";
        setError(message);
        trackEvent("crew_error", { message });
      } finally {
        setRunning(false);
      }
    },
    [handleEvent],
  );

  // ?url= deep link (from /jobs "Prep this job") → auto-run once.
  const urlParam = searchParams.get("url");
  const autoRan = useRef(false);
  useEffect(() => {
    if (urlParam && !autoRan.current) {
      autoRan.current = true;
      setMode("Link");
      setUrl(urlParam);
      void run({ url: urlParam });
    }
  }, [urlParam, run]);

  const canRun =
    !running && (mode === "Link" ? url.trim().length > 0 : text.trim().length > 0);

  const startRun = () => {
    if (!canRun) return;
    if (mode === "Link") void run({ url: url.trim() });
    else void run({ text: text.trim() });
  };

  const steps = AGENT_STEPS.map((s) => ({ ...s, status: statuses[s.key] }));
  const idle = !running && !result && !error;

  const fillSample = (sample: (typeof SAMPLES)[number]) => {
    setMode("Paste text");
    setText(sample.text);
    trackEvent("sample_fill", { venue_type: sample.label.toLowerCase() });
  };

  const openSaved = () => {
    if (!saved) return;
    setResult(saved);
    setRestored(true);
  };

  return (
    <main>
      <NavBar title="Prep" large />

      <section style={{ padding: "0 16px" }}>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.4,
            color: "var(--sys-gray, #8E8E93)",
            margin: "4px 4px 14px",
          }}
        >
          Paste a bartender job link. Six agents research the venue and build your
          walk-in play.
        </p>

        <SegmentedControl options={MODES} value={mode} onChange={setMode} />

        <div style={{ marginTop: 12 }}>
          {mode === "Link" ? (
            <TextField
              value={url}
              onChange={setUrl}
              placeholder="https://newyork.craigslist.org/…"
            />
          ) : (
            <TextField
              value={text}
              onChange={setText}
              placeholder="Paste the full listing text here…"
              multiline
            />
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <PillButton onPress={startRun} variant="filled" full disabled={!canRun} loading={running}>
            Run the crew
          </PillButton>
        </div>
      </section>

      {idle ? (
        <>
          <section style={{ padding: "21px 16px 0" }}>
            <div className="chips">
              {SAMPLES.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  className="chip"
                  onClick={() => fillSample(sample)}
                >
                  <span className="chip__icon">{sample.icon}</span>
                  {sample.label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 13, color: "var(--sys-gray, #8E8E93)", margin: "8px 4px 0" }}>
              No link handy? Tap a venue type to try a sample listing.
            </p>
          </section>

          {saved ? (
            <section style={{ padding: "35px 16px 0" }}>
              <InsetGroup header="Recent">
                <Row
                  icon={<Martini size={17} strokeWidth={2} color="#007AFF" />}
                  label={saved.venue?.name ?? saved.job.title ?? "Your last prep"}
                  value={`Fit ${saved.synthesis.fitScore}`}
                  chevron
                  onPress={openSaved}
                />
              </InsetGroup>
            </section>
          ) : null}

          <section style={{ padding: "35px 16px 0" }}>
            <InsetGroup
              header="How it works"
              footer="Six agents, ~40 seconds. Your walk-in play saves on this phone."
            >
              <Row
                icon={<Link2 size={17} strokeWidth={2} color="#007AFF" />}
                label="Paste any bartender job link"
              />
              <Row
                icon={<Search size={17} strokeWidth={2} color="#FF9500" />}
                label="The crew researches the venue live"
              />
              <Row
                icon={<FileText size={17} strokeWidth={2} color="#AF52DE" />}
                label="Walk in with a plan, resume, and answers"
              />
            </InsetGroup>
          </section>
        </>
      ) : null}

      {running ? (
        <section style={{ padding: "16px 16px 0" }}>
          <Card>
            <CrewProgress steps={steps} />
          </Card>
        </section>
      ) : null}

      {error && !running ? (
        <section style={{ padding: "16px 16px 0" }}>
          <Card>
            <h3 style={{ fontSize: 17, fontWeight: 600, margin: "0 0 6px", color: "#FF3B30" }}>
              The crew couldn&rsquo;t finish
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.45, margin: 0, color: "var(--sys-gray, #8E8E93)" }}>
              {error}
            </p>
            <p style={{ fontSize: 13, lineHeight: 1.45, margin: "10px 0 0", color: "var(--sys-gray, #8E8E93)" }}>
              Some job boards block fetches — switch to &ldquo;Paste text&rdquo; and drop the
              listing in directly.
            </p>
          </Card>
        </section>
      ) : null}

      {result && !running ? (
        <ResultView
          result={result}
          restored={restored}
          onResume={() => router.push("/resume")}
          onInterview={() => router.push("/interview")}
        />
      ) : null}

      <InstallCoach />
    </main>
  );
}

/* ── result rendering ────────────────────────────── */

function ResultView({
  result,
  restored,
  onResume,
  onInterview,
}: {
  result: AnalyzeResult;
  restored: boolean;
  onResume: () => void;
  onInterview: () => void;
}) {
  return (
    <div>
      {restored ? (
        <p
          style={{
            fontSize: 13,
            color: "var(--sys-gray, #8E8E93)",
            margin: "16px 20px 0",
          }}
        >
          Your last prep, saved{" "}
          {new Date(result.analyzedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
          . Run the crew again anytime.
        </p>
      ) : null}

      {result.venue ? <VenueCard venue={result.venue} job={result} /> : <NoVenueCard result={result} />}

      {result.menu ? <MenuGroup menu={result.menu} /> : null}
      {result.people ? <PeopleGroup people={result.people} /> : null}
      {result.reviews ? <ReviewsGroup reviews={result.reviews} /> : null}

      <SynthesisCard synthesis={result.synthesis} />

      <section style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <PillButton onPress={onResume} variant="filled" full>
          <FileText size={17} strokeWidth={2.2} />
          Build my resume for this job
        </PillButton>
        <PillButton onPress={onInterview} variant="tinted" full>
          <Mic size={17} strokeWidth={2.2} />
          Practice the interview
        </PillButton>
      </section>
    </div>
  );
}

function VenueCard({ venue, job }: { venue: VenueIntel; job: AnalyzeResult }) {
  const metaBits = [venue.kind, venue.priceLevel, venue.neighborhood ?? job.job.neighborhood]
    .map((b) => (b ? b.trim() : ""))
    .filter(Boolean);

  return (
    <section style={{ padding: "16px 16px 0" }}>
      <Card>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "#007AFF",
          }}
        >
          The venue
          {venue.confidence !== "high" ? ` · ${venue.confidence} confidence` : ""}
        </span>
        <h2 style={{ fontSize: 24, fontWeight: 700, margin: "6px 0 2px", letterSpacing: "-0.02em" }}>
          {venue.name}
        </h2>
        {metaBits.length > 0 ? (
          <p style={{ fontSize: 14, fontWeight: 500, color: "var(--sys-gray, #8E8E93)", margin: "0 0 8px" }}>
            {metaBits.join(" · ")}
          </p>
        ) : null}
        <p style={{ fontSize: 15, lineHeight: 1.45, margin: "0 0 4px" }}>{venue.vibe}</p>
        {venue.hospitalityGroup ? (
          <p style={{ fontSize: 13, color: "var(--sys-gray, #8E8E93)", margin: "6px 0 0" }}>
            Part of {venue.hospitalityGroup}
          </p>
        ) : null}
        {venue.address ? (
          <p style={{ fontSize: 13, color: "var(--sys-gray, #8E8E93)", margin: "4px 0 0" }}>
            {venue.address}
          </p>
        ) : null}

        {venue.links.length > 0 ? (
          <div style={{ marginTop: 12 }}>
            {venue.links.map((link) => (
              <Row
                key={link.url}
                label={link.label}
                icon={<Link2 size={17} strokeWidth={2} color="#007AFF" />}
                chevron
                onPress={() => window.open(link.url, "_blank", "noopener,noreferrer")}
              />
            ))}
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function NoVenueCard({ result }: { result: AnalyzeResult }) {
  return (
    <section style={{ padding: "16px 16px 0" }}>
      <Card>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
          {result.job.title || "Unnamed venue"}
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.45, margin: 0, color: "var(--sys-gray, #8E8E93)" }}>
          The listing hides the venue name, so the crew couldn&rsquo;t research the spot
          itself. The play below works from the listing alone.
        </p>
      </Card>
    </section>
  );
}

function itemRows(items: string[], icon: ReactNode, prefix: string) {
  return items.map((item, i) => <Row key={`${prefix}-${i}`} label={item} icon={icon} />);
}

function MenuGroup({ menu }: { menu: MenuIntel }) {
  return (
    <section style={{ padding: "35px 16px 0" }}>
      <InsetGroup header="Menu intel" footer={menu.summary || undefined}>
        {itemRows(menu.signatureItems, <UtensilsCrossed size={17} strokeWidth={2} color="#FF9500" />, "sig")}
        {itemRows(menu.cocktails, <Martini size={17} strokeWidth={2} color="#AF52DE" />, "ckt")}
        {itemRows(menu.talkingPoints, <MessageCircle size={17} strokeWidth={2} color="#007AFF" />, "tp")}
      </InsetGroup>
    </section>
  );
}

function PeopleGroup({ people }: { people: PeopleIntel }) {
  return (
    <section style={{ padding: "35px 16px 0" }}>
      <InsetGroup header="The people" footer={people.summary || undefined}>
        {itemRows(
          [...people.owners, ...people.management],
          <UserRound size={17} strokeWidth={2} color="#34C759" />,
          "ppl",
        )}
        {people.history ? (
          <Row label={people.history} icon={<BookOpen size={17} strokeWidth={2} color="#8E8E93" />} />
        ) : null}
        {itemRows(
          people.turnoverSignals,
          <AlertTriangle size={17} strokeWidth={2} color="#FF9500" />,
          "turn",
        )}
      </InsetGroup>
    </section>
  );
}

function ReviewsGroup({ reviews }: { reviews: ReviewIntel }) {
  const footer = [reviews.rating, reviews.summary].filter(Boolean).join(" — ") || undefined;
  return (
    <section style={{ padding: "35px 16px 0" }}>
      <InsetGroup header="What guests say" footer={footer}>
        {itemRows(reviews.praise, <ThumbsUp size={17} strokeWidth={2} color="#34C759" />, "pra")}
        {itemRows(reviews.complaints, <ThumbsDown size={17} strokeWidth={2} color="#FF3B30" />, "com")}
        {itemRows(
          reviews.serviceNotes,
          <ConciergeBell size={17} strokeWidth={2} color="#007AFF" />,
          "svc",
        )}
      </InsetGroup>
    </section>
  );
}

function SynthesisCard({ synthesis }: { synthesis: Synthesis }) {
  const listStyle: CSSProperties = {
    fontSize: 15,
    lineHeight: 1.5,
    margin: "6px 0 0",
    paddingLeft: 22,
  };
  const h = (label: string) => (
    <h4
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        color: "var(--sys-gray, #8E8E93)",
        margin: "16px 0 0",
      }}
    >
      {label}
    </h4>
  );

  return (
    <section style={{ padding: "35px 16px 0" }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <ScoreRing score={synthesis.fitScore} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#007AFF",
              }}
            >
              Your play
            </span>
            <p style={{ fontSize: 15, lineHeight: 1.45, margin: "4px 0 0", fontWeight: 500 }}>
              {synthesis.brief}
            </p>
          </div>
        </div>

        {synthesis.walkInPlan.length > 0 ? (
          <>
            {h("Walk-in plan")}
            <ol style={listStyle}>
              {synthesis.walkInPlan.map((step, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {step}
                </li>
              ))}
            </ol>
          </>
        ) : null}

        {synthesis.talkingPoints.length > 0 ? (
          <>
            {h("Talking points")}
            <ul style={listStyle}>
              {synthesis.talkingPoints.map((tp, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {tp}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {synthesis.questionsToAsk.length > 0 ? (
          <>
            {h("Questions to ask them")}
            <ul style={listStyle}>
              {synthesis.questionsToAsk.map((q, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {q}
                </li>
              ))}
            </ul>
          </>
        ) : null}

        {synthesis.redFlags.length > 0 ? (
          <>
            {h("Red flags")}
            <ul style={{ ...listStyle, color: "#FF3B30" }}>
              {synthesis.redFlags.map((rf, i) => (
                <li key={i} style={{ marginBottom: 6 }}>
                  {rf}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>
    </section>
  );
}
