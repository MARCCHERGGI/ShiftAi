import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Jigger — AI copilot for bartenders";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#FBFAF7",
          display: "flex",
          flexDirection: "column",
          padding: 80,
          position: "relative",
          fontFamily: 'Georgia, "Times New Roman", serif',
        }}
      >
        <div
          style={{
            position: "absolute", inset: 0,
            backgroundImage:
              "radial-gradient(800px 500px at 12% 8%, rgba(10,10,10,0.05), transparent 60%), radial-gradient(700px 500px at 88% 92%, rgba(10,10,10,0.06), transparent 60%)",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 18, position: "relative" }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: 18,
              background: "#0A0A0A",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="#FFFFFF" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
              <path d="M6 4 H18 L14 12 V12.5 L18 20 H6 L10 12.5 V12 Z" />
              <line x1="7.4" y1="7" x2="16.6" y2="7" strokeWidth="0.8" opacity="0.55" />
              <line x1="8.6" y1="9.4" x2="15.4" y2="9.4" strokeWidth="0.8" opacity="0.40" />
            </svg>
          </div>
          <div
            style={{
              fontSize: 24,
              letterSpacing: "0.32em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "#0A0A0A",
              fontFamily: 'ui-monospace, "Cascadia Mono", "Consolas", monospace',
              display: "flex",
            }}
          >
            Jigger · Manhattan FOH
          </div>
        </div>

        <div
          style={{
            position: "relative",
            marginTop: 76,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              fontSize: 188,
              lineHeight: 0.92,
              letterSpacing: "-0.045em",
              fontWeight: 400,
              color: "#0A0A0A",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span style={{ fontStyle: "italic", display: "flex" }}>Manhattan</span>
            <span style={{ display: "flex" }}>front of house.</span>
          </div>
          <div
            style={{
              marginTop: 32,
              fontSize: 32,
              lineHeight: 1.3,
              color: "rgba(10,10,10,0.66)",
              maxWidth: 920,
              display: "flex",
              fontStyle: "italic",
              fontWeight: 400,
            }}
          >
            Real-time listings, restaurant research, resumes tailored to the venue, interview prep.
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            left: 80, right: 80, bottom: 64,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ width: 36, height: 1, background: "rgba(10,10,10,0.32)", display: "flex" }} />
          <div
            style={{
              fontSize: 18,
              letterSpacing: "0.28em",
              textTransform: "uppercase",
              color: "rgba(10,10,10,0.50)",
              fontFamily: 'ui-monospace, "Cascadia Mono", "Consolas", monospace',
              fontWeight: 600,
              display: "flex",
            }}
          >
            jigger-omega.vercel.app
          </div>
          <div style={{ flex: 1, height: 1, backgroundImage: "linear-gradient(to right, rgba(10,10,10,0.20), transparent)", display: "flex" }} />
        </div>
      </div>
    ),
    { ...size },
  );
}
