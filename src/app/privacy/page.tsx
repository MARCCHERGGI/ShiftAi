import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Jigger handles your data.",
};

const EFFECTIVE = "April 22, 2026";
const CONTACT = "hergienterprises@gmail.com";

export default function PrivacyPage() {
  return (
    <div className="page-enter px-6 max-w-[680px] mx-auto">
      <header className="pt-14 pb-2">
        <p className="label" style={{ color: "var(--accent)" }}>Legal</p>
        <h1 className="display mt-3">Privacy.</h1>
        <p className="footnote mt-3" style={{ color: "var(--ink-faint)" }}>
          Effective {EFFECTIVE}
        </p>
      </header>

      <article className="pt-8 pb-6 space-y-10">
        <Section title="Who we are">
          Jigger helps bartenders and hospitality workers research jobs,
          build resumes, and prep for interviews. This page explains what we
          collect, why, and what you can do.
        </Section>

        <Section title="What you give us">
          <ul className="list-disc pl-5 space-y-1">
            <li>Job listings you paste in.</li>
            <li>Resume details you enter.</li>
            <li>Interview answers you submit.</li>
            <li>A profile photo, if you upload one.</li>
          </ul>
          <p>
            Most of this stays on your device, in your browser&apos;s local
            storage. We do not sell it. We do not share it for advertising.
          </p>
        </Section>

        <Section title="What we collect automatically">
          <ul className="list-disc pl-5 space-y-1">
            <li>Anonymous usage events — which page, success/failure, timing.</li>
            <li>Approximate location (country, city) from IP.</li>
            <li>User-agent string for compatibility.</li>
            <li>Vercel Web Analytics + Speed Insights, aggregated.</li>
          </ul>
        </Section>

        <Section title="AI processing">
          Listings, answers, and resume fields are sent to OpenAI for
          inference. OpenAI does not use API inputs to train models. We
          cache analyzed listings by content hash for 24 hours so duplicate
          submissions return instantly.
        </Section>

        <Section title="Storage">
          Profile, analyses, and interview results live in your browser.
          Anonymous events live in a hosted key-value store with a rolling
          5,000-entry window. No personal identifiers attached.
        </Section>

        <Section title="Third parties">
          OpenAI · Vercel · Upstash. That&apos;s it.
        </Section>

        <Section title="Your rights">
          Clear site data in your browser to wipe device-side state. Email
          us at{" "}
          <a href={`mailto:${CONTACT}`} style={{ color: "var(--accent)", fontWeight: 500 }}>
            {CONTACT}
          </a>{" "}
          to request deletion of any server-side data tied to your session.
        </Section>

        <Section title="Children">
          Not intended for users under 13.
        </Section>

        <Section title="Contact">
          <a href={`mailto:${CONTACT}`} style={{ color: "var(--accent)", fontWeight: 500 }}>
            {CONTACT}
          </a>
        </Section>
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="title-3">{title}</h2>
      <div className="body space-y-3" style={{ color: "var(--ink)" }}>
        {children}
      </div>
    </section>
  );
}
