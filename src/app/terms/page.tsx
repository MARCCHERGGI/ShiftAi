import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The rules for using Jigger.",
};

const EFFECTIVE = "April 22, 2026";
const CONTACT = "hergienterprises@gmail.com";

export default function TermsPage() {
  return (
    <div className="page-enter px-6 max-w-[680px] mx-auto">
      <header className="pt-14 pb-2">
        <p className="label" style={{ color: "var(--accent)" }}>Legal</p>
        <h1 className="display mt-3">Terms.</h1>
        <p className="footnote mt-3" style={{ color: "var(--ink-faint)" }}>
          Effective {EFFECTIVE}
        </p>
      </header>

      <article className="pt-8 pb-6 space-y-10">
        <Section title="Acceptance">
          By using Jigger you agree to these terms. If you don&apos;t,
          don&apos;t use the app.
        </Section>

        <Section title="What it does">
          AI-assisted research, interview coaching, and resume drafting for
          hospitality jobs. No employment guarantees, no accuracy promises
          on venue details, no interview success warranties.
        </Section>

        <Section title="Your responsibilities">
          <ul className="list-disc pl-5 space-y-1">
            <li>You&apos;re 13 or older.</li>
            <li>You only submit content you have the right to share.</li>
            <li>You don&apos;t misrepresent yourself on real applications.</li>
            <li>You don&apos;t bypass rate limits or overload the service.</li>
          </ul>
        </Section>

        <Section title="AI output">
          Models are probabilistic. Output may be wrong. Verify before
          using anything in a real application or interview.
        </Section>

        <Section title="No warranty">
          Provided “as is”. No warranties of merchantability, fitness for
          a particular purpose, or non-infringement. Coaching is not legal
          or career advice.
        </Section>

        <Section title="Liability">
          Operators are not liable for indirect, incidental, or
          consequential damages — lost shifts, hiring outcomes, anything
          downstream of using the app.
        </Section>

        <Section title="Termination">
          We can suspend or terminate access for violations. You can stop
          any time — no account, nothing to cancel.
        </Section>

        <Section title="Governing law">
          State of New York, United States.
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
