import type { Metadata, Viewport } from "next";
import { Inter, Fraunces, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import PageviewTracker from "@/src/components/PageviewTracker";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500"],
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shiftai-six.vercel.app";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#FFFFFF",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Jigger — AI for bartender jobs in NYC", template: "%s — Jigger" },
  description: "The AI agent for bartenders. Finds Manhattan bar jobs in real time, researches the venue, tailors your resume, and preps you for the interview. Server, host, barback covered too.",
  keywords: ["Bartender Jobs NYC", "Bartender Jobs Manhattan", "AI for Bartenders", "Bar Jobs NYC", "Bartending AI", "Server Jobs NYC", "Host Jobs", "Front of House", "Restaurant Jobs NYC", "Hospitality AI"],
  applicationName: "Jigger",
  category: "business",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website", siteName: "Jigger", url: SITE_URL,
    title: "Jigger — AI for bartender jobs in NYC",
    description: "The AI agent for bartenders. Live Manhattan bar listings, venue research, resume tailored to the bar, interview prep that knows the room.",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image", title: "Jigger — AI for bartender jobs", description: "The AI agent for bartenders. Live NYC listings, venue-aware resumes, interview prep." },
  appleWebApp: { capable: true, title: "Jigger", statusBarStyle: "default" },
  formatDetection: { email: false, address: false, telephone: false },
  robots: { index: true, follow: true },
  other: {
    "apple-mobile-web-app-capable":         "yes",
    "apple-mobile-web-app-status-bar-style":"default",
    "color-scheme":                         "light",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${fraunces.variable} ${mono.variable} antialiased`}>
        {/* SVG filter bank — real Liquid Glass refraction (Chromium) */}
        <svg
          width="0"
          height="0"
          aria-hidden
          style={{ position: "absolute", pointerEvents: "none", overflow: "hidden" }}
        >
          <defs>
            <filter id="lg-refract" x="-5%" y="-5%" width="110%" height="110%">
              <feTurbulence type="fractalNoise" baseFrequency="0.012 0.012" numOctaves="2" seed="92" result="noise" />
              <feGaussianBlur in="noise" stdDeviation="2.4" result="softNoise" />
              <feDisplacementMap in="SourceGraphic" in2="softNoise" scale="32" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id="lg-refract-soft" x="-3%" y="-3%" width="106%" height="106%">
              <feTurbulence type="fractalNoise" baseFrequency="0.018 0.018" numOctaves="1" seed="42" result="n2" />
              <feGaussianBlur in="n2" stdDeviation="1.5" result="sn2" />
              <feDisplacementMap in="SourceGraphic" in2="sn2" scale="14" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            <filter id="lg-specular" colorInterpolationFilters="sRGB">
              <feTurbulence type="fractalNoise" baseFrequency="0.01" numOctaves="1" seed="5" result="turb" />
              <feGaussianBlur in="turb" stdDeviation="3" result="softMap" />
              <feSpecularLighting in="softMap" surfaceScale="4" specularConstant="0.9" specularExponent="90" lightingColor="#ffffff" result="spec">
                <fePointLight x="-200" y="-200" z="300" />
              </feSpecularLighting>
              <feComposite in="spec" in2="SourceGraphic" operator="in" result="specMasked" />
              <feComposite in="SourceGraphic" in2="specMasked" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
            </filter>
          </defs>
        </svg>

        {children}
        <PageviewTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
