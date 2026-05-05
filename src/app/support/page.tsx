import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with Jigger.",
};

const CONTACT = "hergienterprises@gmail.com";

const Arrow = () => (
  <svg viewBox="0 0 24 24" className="w-[16px] h-[16px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const Chev = () => (
  <svg viewBox="0 0 24 24" className="w-[14px] h-[14px]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const FAQS = [
  {
    q: "Why is my analysis slow?",
    a: "Four AI agents run in parallel. Typical run is 20–40 seconds. Obscure venues take longer.",
  },
  {
    q: "Where are my results saved?",
    a: "In your browser, on this device. Clear site data to remove. Cross-device sync is on the roadmap.",
  },
  {
    q: "Can I delete my data?",
    a: "Clear site data in your browser. Email us to delete server-side event logs.",
  },
  {
    q: "Is the AI always right?",
    a: "No. It's a research assistant, not an oracle. Verify anything important.",
  },
  {
    q: "Rate-limit error?",
    a: "Each IP is capped at a few analyses per minute. Wait a moment, or come back in an hour.",
  },
];

export default function SupportPage() {
  return (
    <div className="page-enter px-6 max-w-[680px] mx-auto">
      <header className="pt-14 pb-2">
        <p className="label" style={{ color: "var(--accent)" }}>Help</p>
        <h1 className="display mt-3">Support.</h1>
      </header>

      <a
        href={`mailto:${CONTACT}?subject=Jigger%20support`}
        className="card mt-10 flex items-center justify-between press"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <div>
          <p className="label" style={{ color: "var(--accent)" }}>Email</p>
          <p className="title-3 mt-1">{CONTACT}</p>
          <p className="footnote mt-1" style={{ color: "var(--ink-muted)" }}>
            We read everything. Most replies under 24 h.
          </p>
        </div>
        <Arrow />
      </a>

      <p className="label mt-12 mb-3">Common questions</p>
      <div>
        {FAQS.map((f, i) => (
          <details
            key={i}
            className="group"
            style={{ borderBottom: "1px solid var(--hairline)" }}
          >
            <summary className="flex items-center justify-between py-4 cursor-pointer list-none">
              <span className="callout font-semibold">{f.q}</span>
              <span
                style={{ color: "var(--ink-faint)" }}
                className="group-open:rotate-180 transition-transform"
              >
                <Chev />
              </span>
            </summary>
            <p className="body pb-5 pr-6" style={{ color: "var(--ink-muted)" }}>
              {f.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}
