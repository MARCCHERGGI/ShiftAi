import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A0A0A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
        }}
      >
        <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="#FFFFFF" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
          <path d="M6 4 H18 L14 12 V12.5 L18 20 H6 L10 12.5 V12 Z" />
          <line x1="7.4" y1="7" x2="16.6" y2="7" strokeWidth="0.8" opacity="0.55" />
          <line x1="8.6" y1="9.4" x2="15.4" y2="9.4" strokeWidth="0.8" opacity="0.40" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
